const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const tello = require("./tello.js");
const WebSocket = require("ws");
const waitOn = require("wait-on");

const isProduction =
  process.env.NODE_ENV === "production" || !process || !process.env || !process.env.NODE_ENV;
const isDevelopment = !isProduction;

const menu = require("./menu");
const port = 3005; // Updated to match the new port
const selfHost = `http://localhost:${port}`;
const GANGLION_DEVICE_NAME = "Ganglion-";
const ROBOT_WS_PORT = 8777;
const maxSpeed = 40;
const minSpeed = 15;
let bleCallback = null;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let pythonProcess;
const isWin = process.platform === "win32";
let ws = null;
let pythonForceKillTimer = null; // timeout handle for forced kill
let reconnectInProgress = false; // guard against overlapping reconnects
let pythonStopping = false;
let backendRestartTimer = null;
let activeMechDogNameMatch = null;
const robotBackend = String(process.env.ROBOT_BACKEND || "mechdog").toLowerCase();
const robotDisplayName = robotBackend === "mechdog" ? "MechDog" : "VEX AIM";
const ROBOT_CONFIG_FILE = "robot-config.json";

function getRobotConfigPath() {
  return path.join(app.getPath("userData"), ROBOT_CONFIG_FILE);
}

function readRobotConfig() {
  try {
    const configPath = getRobotConfigPath();
    if (!fs.existsSync(configPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.warn(`[${robotDisplayName}] Failed to read robot config:`, error);
    return {};
  }
}

function writeRobotConfig(config) {
  const configPath = getRobotConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getMechDogNameMatch() {
  return String(readRobotConfig().mechdogNameMatch || "").trim();
}

function setMechDogNameMatch(value) {
  const mechdogNameMatch = String(value || "").trim();
  writeRobotConfig({
    ...readRobotConfig(),
    mechdogNameMatch
  });
  return mechdogNameMatch;
}

function getPythonEnv() {
  const env = { ...process.env };
  if (robotBackend === "mechdog") {
    const mechdogNameMatch = getMechDogNameMatch();
    if (mechdogNameMatch) {
      env.MECHDOG_NAME_MATCH = mechdogNameMatch;
    } else {
      delete env.MECHDOG_NAME_MATCH;
    }
  }
  return env;
}

function publishRobotStatus(status) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("vex-status", status);
}

function clearBackendRestartTimer() {
  if (backendRestartTimer) {
    clearTimeout(backendRestartTimer);
    backendRestartTimer = null;
  }
}

function isRobotBackendPortResponsive(timeoutMs = 300) {
  const net = require("net");
  return new Promise((res) => {
    const sock = net.createConnection({ port: ROBOT_WS_PORT, host: "127.0.0.1" });
    const timer = setTimeout(() => {
      res(false);
      try {
        sock.destroy();
      } catch {}
    }, timeoutMs);

    sock.once("connect", () => {
      clearTimeout(timer);
      sock.end();
      res(true);
    });
    sock.once("error", () => {
      clearTimeout(timer);
      res(false);
    });
  });
}

async function restoreBackendConnection() {
  try {
    if (!pythonProcess) {
      await startPythonServer();
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      await createWebSocketConnection();
    }
    pollRobotStatus();
  } catch (error) {
    console.error(`[${robotDisplayName}] Failed to restore backend connection:`, error);
    throw error;
  }
}

function scheduleBackendRestart(reason = "unknown") {
  if (pythonStopping || !win || win.isDestroyed()) {
    return;
  }
  if (backendRestartTimer) {
    return;
  }

  console.warn(`[${robotDisplayName}] Scheduling backend restart after ${reason}`);
  publishRobotStatus({ wsConnected: false, robotConnected: false, backendRunning: false });
  backendRestartTimer = setTimeout(async () => {
    backendRestartTimer = null;
    try {
      await restoreBackendConnection();
      console.log(`[${robotDisplayName}] Backend restored successfully`);
    } catch (error) {
      console.error(`[${robotDisplayName}] Backend restart attempt failed:`, error);
      scheduleBackendRestart("failed restart attempt");
    }
  }, 1500);
}

function getPythonExecutable() {
  if (isDevelopment) {
    // Development: Use virtual environment
    const venvPath = path.join(__dirname, "..", "..", ".venv", "Scripts", "python.exe");
    console.log("[PYTHON] isDevelopment:", isDevelopment);
    console.log("[PYTHON] Checking venv python at:", venvPath, "exists:", fs.existsSync(venvPath));
    if (fs.existsSync(venvPath)) {
      return venvPath;
    }
    console.log("[PYTHON] Falling back to system python");
    // Fallback to system python
    return "python";
  } else {
    // Production: Use bundled executable
    console.log("[PYTHON] isProduction:", !isDevelopment);
    console.log("[PYTHON] process.resourcesPath:", process.resourcesPath);
    const exeCandidates =
      robotBackend === "mechdog" ? ["MechDogServer.exe", "VEXServer.exe"] : ["VEXServer.exe"];
    for (const exeName of exeCandidates) {
      const bundledExe = path.join(process.resourcesPath, "python", exeName);
      console.log(
        "[PYTHON] Checking bundled exe at:",
        bundledExe,
        "exists:",
        fs.existsSync(bundledExe)
      );
      if (fs.existsSync(bundledExe)) {
        console.log(`[PYTHON] Using bundled ${exeName} (standalone executable)`);
        return { exe: bundledExe, standalone: true };
      }
    }
    // Fallback to script with bundled python
    const bundledPython = path.join(process.resourcesPath, "python", "python.exe");
    const bundledScript = path.join(
      process.resourcesPath,
      "python",
      robotBackend === "mechdog" ? "MechDogServer.py" : "VEXServer.py"
    );
    console.log(
      "[PYTHON] Checking bundled python at:",
      bundledPython,
      "exists:",
      fs.existsSync(bundledPython)
    );
    console.log(
      "[PYTHON] Checking bundled script at:",
      bundledScript,
      "exists:",
      fs.existsSync(bundledScript)
    );
    if (fs.existsSync(bundledPython) && fs.existsSync(bundledScript)) {
      return { exe: bundledPython, script: bundledScript };
    }
    // Final fallback
    console.warn("[PYTHON] No bundled exe or python+script found. Falling back to system python");
    return "python";
  }
}

function getPythonScript() {
  if (isDevelopment) {
    const useMock =
      process.env.VEX_MOCK === "1" || String(process.env.VEX_MOCK || "").toLowerCase() === "true";
    const scriptName = useMock
      ? "VEXServer_dev.py"
      : robotBackend === "mechdog"
      ? "MechDogServer.py"
      : "VEXServer.py";
    const devPath = path.join(__dirname, "..", "..", "resources", "python", scriptName);
    console.log(
      `[PYTHON] getPythonScript dev -> ${scriptName}:`,
      devPath,
      "exists:",
      fs.existsSync(devPath)
    );
    return devPath;
  } else {
    const scriptName = robotBackend === "mechdog" ? "MechDogServer.py" : "VEXServer.py";
    const prodPath = path.join(process.resourcesPath, "python", scriptName);
    console.log(
      "[PYTHON] getPythonScript prod path:",
      prodPath,
      "exists:",
      fs.existsSync(prodPath)
    );
    return prodPath;
  }
}

async function startPythonServer() {
  if (pythonProcess) {
    return;
  }

  if (await isRobotBackendPortResponsive()) {
    console.log(`[PYTHON] Reusing existing ${robotDisplayName} backend on port ${ROBOT_WS_PORT}`);
    return;
  }

  // Clear any lingering force-kill timer from a prior stop
  if (pythonForceKillTimer) {
    clearTimeout(pythonForceKillTimer);
    pythonForceKillTimer = null;
  }
  clearBackendRestartTimer();
  pythonStopping = false;
  const pythonExe = getPythonExecutable();
  const pythonEnv = getPythonEnv();
  console.log("[PYTHON] Resolved python executable:", pythonExe);
  if (robotBackend === "mechdog" && pythonEnv.MECHDOG_NAME_MATCH) {
    console.log("[PYTHON] MECHDOG_NAME_MATCH:", pythonEnv.MECHDOG_NAME_MATCH);
  }
  activeMechDogNameMatch = robotBackend === "mechdog" ? pythonEnv.MECHDOG_NAME_MATCH || "" : null;

  try {
    if (typeof pythonExe === "object") {
      if (pythonExe.standalone) {
        // Standalone exe (e.g., PyInstaller bundle) - no script argument needed
        console.log("[PYTHON] Spawning standalone exe:", pythonExe.exe);
        pythonProcess = spawn(pythonExe.exe, [], { stdio: "pipe", env: pythonEnv });
      } else {
        // Python interpreter + script
        console.log("[PYTHON] Spawning bundled python + script:", pythonExe.exe, pythonExe.script);
        pythonProcess = spawn(pythonExe.exe, [pythonExe.script], { stdio: "pipe", env: pythonEnv });
      }
    } else if (typeof pythonExe === "string" && pythonExe.endsWith(".exe") && isProduction) {
      console.log("[PYTHON] Spawning bundled exe:", pythonExe);
      pythonProcess = spawn(pythonExe, [], { stdio: "pipe", env: pythonEnv });
    } else {
      const script = getPythonScript();
      console.log("[PYTHON] Spawning:", pythonExe, script);
      pythonProcess = spawn(pythonExe, [script], { stdio: "pipe", env: pythonEnv });
    }
  } catch (spawnErr) {
    console.error("[PYTHON] Spawn error:", spawnErr);
    scheduleBackendRestart("spawn error");
    return; // abort start
  }

  pythonProcess?.stdout?.on("data", (data) => console.log(`PYTHON: ${data}`));
  pythonProcess?.stderr?.on("data", (data) => console.error(`PYTHON ERROR: ${data}`));
  pythonProcess?.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null;
    activeMechDogNameMatch = null;
    if (!pythonStopping) {
      scheduleBackendRestart(`python exit code ${code}`);
    }
  });

  // Lightweight TCP poll instead of waitOn to avoid WebSocket handshake noise
  const maxAttempts = 25;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const portReady = await isRobotBackendPortResponsive();
    if (portReady) {
      console.log("[PYTHON] WebSocket TCP port responsive");
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
    if (attempt === maxAttempts) {
      console.warn("[PYTHON] WebSocket port not responsive after retries; proceeding anyway");
    }
  }
}

async function stopPythonServer() {
  console.log(`Stopping Python ${robotDisplayName} server...`);
  pythonStopping = true;
  clearBackendRestartTimer();
  if (!pythonProcess) {
    console.log("Python process already stopped");
    return;
  }
  return new Promise((resolve) => {
    if (pythonForceKillTimer) {
      clearTimeout(pythonForceKillTimer);
      pythonForceKillTimer = null;
    }
    const proc = pythonProcess;

    // Check if process is already dead
    if (proc.exitCode !== null || proc.killed) {
      console.log("Python process already exited or killed");
      pythonProcess = null;
      resolve();
      return;
    }

    const finish = (code) => {
      if (pythonProcess === proc) pythonProcess = null;
      activeMechDogNameMatch = null;
      console.log(`Python process stopped with code ${code}`);
      resolve();
    };
    proc.once("close", finish);
    try {
      proc.kill("SIGTERM");
    } catch (e) {
      console.warn("SIGTERM failed:", e);
    }
    pythonForceKillTimer = setTimeout(() => {
      if (pythonProcess === proc) {
        console.log("Force killing Python process (timeout)...");
        if (isWin) {
          try {
            exec(`taskkill /F /PID ${proc.pid}`, (err) => {
              if (err) console.warn("taskkill failed:", err);
            });
          } catch (e) {
            /* ignore */
          }
        } else {
          try {
            proc.kill("SIGKILL");
          } catch {}
        }
      }
      pythonForceKillTimer = null;
    }, 5000);
  });
}

async function reconnectVEX(nextMechDogNameMatch) {
  console.log(`Reconnecting to ${robotDisplayName}...`);
  if (reconnectInProgress) {
    console.log("Reconnect skipped: already in progress");
    return { success: false, message: "Reconnect already running" };
  }
  reconnectInProgress = true;
  try {
    if (robotBackend === "mechdog" && nextMechDogNameMatch !== undefined) {
      const previousMechDogNameMatch = getMechDogNameMatch();
      const mechdogNameMatch = setMechDogNameMatch(nextMechDogNameMatch);
      if (
        mechdogNameMatch !== previousMechDogNameMatch ||
        mechdogNameMatch !== activeMechDogNameMatch
      ) {
        console.log(`[${robotDisplayName}] MechDog name match changed; restarting backend`);
        if (ws) {
          try {
            ws.close();
          } catch {}
          ws = null;
        }
        await stopPythonServer();
        await new Promise((r) => setTimeout(r, 1000));
        await startPythonServer();
        await createWebSocketConnection();
      }
    }

    // Instead of killing the Python process, just tell it to reconnect to the robot
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("Sending reconnect_robot command to Python server...");
      ws.send(JSON.stringify({ action: "reconnect_robot" }));

      // Wait a bit for the reconnection to start
      await new Promise((r) => setTimeout(r, 1000));

      // Request a status update
      pollRobotStatus();

      console.log(`${robotDisplayName} reconnection initiated`);
      return { success: true, message: `Reconnecting to ${robotDisplayName}...` };
    } else {
      // WebSocket isn't connected - fall back to restarting everything
      console.log("WebSocket not connected, restarting Python server...");
      if (ws) {
        try {
          ws.close();
        } catch {}
        ws = null;
      }
      await stopPythonServer();

      // Wait longer before restarting to ensure clean shutdown
      await new Promise((r) => setTimeout(r, 2000));

      await startPythonServer();

      // Wait longer after Python restart for server to be fully ready
      await new Promise((r) => setTimeout(r, 3000));

      // Reconnect WebSocket with retry logic (5 attempts, 2s between each)
      let wsConnected = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`WebSocket connection attempt ${attempt}/5...`);
          await createWebSocketConnection();
          wsConnected = true;
          console.log("✓ WebSocket reconnected successfully");
          break;
        } catch (err) {
          console.warn(`WebSocket reconnection attempt ${attempt} failed:`, err.message);
          if (attempt < 5) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }

      if (!wsConnected) {
        return {
          success: false,
          message: "Failed to reconnect WebSocket after restarting Python server (5 attempts)"
        };
      }

      console.log(`✓ ${robotDisplayName} reconnection completed`);
      return { success: true, message: `Successfully reconnected to ${robotDisplayName}` };
    }
  } catch (error) {
    console.error(`Failed to reconnect to ${robotDisplayName}:`, error);
    return { success: false, message: `Reconnection failed: ${error.message}` };
  } finally {
    reconnectInProgress = false;
  }
}

function createWebSocketConnection() {
  return new Promise((resolve, reject) => {
    let wsTimeout;
    try {
      ws = new WebSocket(`ws://127.0.0.1:${ROBOT_WS_PORT}`);

      ws.on("open", function open() {
        console.log("WebSocket connection opened");
        clearTimeout(wsTimeout);
        attachStatusListener();
        publishRobotStatus({ wsConnected: true, robotConnected: false, backendRunning: true });
        resolve();
      });

      ws.on("error", function error(err) {
        console.error("WebSocket error:", err.message);
        clearTimeout(wsTimeout);
        reject(err);
      });

      ws.on("close", function close() {
        console.log("WebSocket connection closed");
        publishRobotStatus({
          wsConnected: false,
          robotConnected: false,
          backendRunning: !!pythonProcess
        });
        if (!pythonStopping) {
          ws = null;
          scheduleBackendRestart("websocket close");
        }
      });

      // Increase timeout to 10 seconds and add detailed logging
      wsTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          console.warn("WebSocket connection timeout after 10s, terminating...");
          try {
            ws.terminate?.();
          } catch {}
          reject(new Error("WebSocket connection timeout (10s)"));
        }
      }, 10000);
    } catch (error) {
      clearTimeout(wsTimeout);
      reject(error);
    }
  });
}

// --- Status helpers ---
function attachStatusListener() {
  if (!ws) return;
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.robot_connected !== undefined) {
        publishRobotStatus({
          wsConnected: true,
          robotConnected: !!msg.robot_connected,
          backendRunning: true,
          deviceName: msg.device_name,
          deviceAddress: msg.device_address,
          lastError: msg.last_error,
          battery: msg.battery,
          sonarDistanceMm: msg.sonar_distance_mm
        });
      } else if (msg.action === "battery" || msg.action === "sonar") {
        publishRobotStatus({
          wsConnected: true,
          backendRunning: true,
          battery: msg.battery,
          sonarDistanceMm: msg.distance_mm
        });
      }
    } catch {
      /* ignore */
    }
  });
}

function pollRobotStatus() {
  // Guard: skip if WebSocket not ready OR window destroyed
  if (!ws || ws.readyState !== WebSocket.OPEN || !win || win.isDestroyed()) {
    return;
  }
  try {
    ws.send(JSON.stringify({ action: "status" }));
  } catch (err) {
    console.warn("Failed to poll status:", err);
  }
}

function pollRobotTelemetry() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !win || win.isDestroyed()) {
    return;
  }
  try {
    ws.send(JSON.stringify({ action: "battery" }));
    ws.send(JSON.stringify({ action: "sonar" }));
  } catch (err) {
    console.warn("Failed to poll telemetry:", err);
  }
}

async function createWindow() {
  // ---- Start Python VEXServer ----
  await startPythonServer();
  // ---- End Python VEXServer ----

  // If you'd like to set up auto-updating for your app,
  // I'd recommend looking at https://github.com/iffy/electron-updater-example
  // to use the method most suitable for you.
  // eg. autoUpdater.checkForUpdatesAndNotify();

  // if (isProduction) {
  //   // Needs to happen before creating/loading the browser window;
  //   // protocol is only used in prod
  //   protocol.registerBufferProtocol(
  //     Protocol.scheme,
  //     Protocol.requestHandler
  //   ); /* eng-disable PROTOCOL_HANDLER_JS_CHECK */
  // }
  // Create the browser window.
  win = new BrowserWindow({
    width: 1200,
    height: 1000,
    title: `NeuroBlock EMG for ${robotDisplayName}`,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  // Add the event listener here, AFTER creating the window
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Window failed to load:", errorDescription);
  });

  // Load the url of the dev server if in development mode
  // Load the index.html when not in development
  if (isDevelopment) {
    win.loadURL(selfHost);
  } else {
    win.loadFile(path.join(__dirname, "../../build/renderer-mechdog-emg/index.html"));
  }

  // Only do these things when in development
  if (isDevelopment) {
    // Reload
    try {
      require("electron-reloader")(module);
    } catch (_) {}
    // Errors are thrown if the dev tools are opened
    // before the DOM is ready
    win.webContents.once("dom-ready", async () => {
      require("electron-debug")(); // https://github.com/sindresorhus/electron-debug
      win.webContents.openDevTools();
    });
  }

  // Menu
  menu;

  // Emitted when the window is closed.
  win.on("closed", () => {
    // Clear the status polling interval
    clearInterval(statusInterval);
    clearInterval(telemetryInterval);

    // Close WebSocket if open
    if (ws) {
      try {
        ws.close();
      } catch {}
      ws = null;
    }

    // Dereference the window object
    win = null;
  });

  /*-------*/

  /* Code to integrate BLE and Tello Drone */

  win.webContents.on("select-bluetooth-device", (event, deviceList, callback) => {
    bleCallback = callback;
    event.preventDefault();
    //console.log(deviceList);
    win.webContents.send("device_list", deviceList);
    /*
    deviceList.map((x) => {
      console.log(x.deviceName);
    });
    */
    let result = null;
    //selectBluetoothCallback = callback

    /*
    const result = deviceList.find((device) => {
      return device.deviceName === MUSE_DEVICE_NAME;
    });
    */

    //console.log(MuseClient)

    if (result) {
      callback(result.deviceId);

      // Do we listen to characteristics here?
      // Find examples of subscribing to characteristics in electron.js
    } else {
      // The device wasn't found so we need to either wait longer (eg until the
      // device is turned on) or until the user cancels the request
    }
  });

  setInterval(() => {
    //console.log(tello.getState());
    let drone_state = tello.getState();
    win.webContents.send("drone_state", drone_state);
  }, 5000);

  ipcMain.on("select-ble-device", (event, selected_ble_device) => {
    console.log("device selected: ", selected_ble_device);
    if (bleCallback) {
      bleCallback(selected_ble_device);
    }
  });

  function sendCommand(command) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(command));
      console.log("Command sent:", command);
    } else {
      console.error("WebSocket not connected, cannot send command:", command);
    }
  }

  // Initialize WebSocket connection
  restoreBackendConnection().catch((err) => {
    console.error("Failed to establish initial backend connection:", err);
  });

  // Periodic status polling - but clear it when window closes
  const statusInterval = setInterval(pollRobotStatus, 3000);
  const telemetryInterval = setInterval(pollRobotTelemetry, 1000);
  // NOTE: win.on("closed") handler is already defined above in createWindow()

  ipcMain.on("drone-up", (event, response) => {
    let recent_val = parseInt(response);
    let rightVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("Sphero right", rightVal, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 90 }; //For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-down", (event, response) => {
    let recent_val = parseInt(response);
    let downVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("Sphero Left", downVal, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 270 }; //For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-forward", (event, response) => {
    let recent_val = parseInt(response);
    let forwardVal =
      recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("drone forward", forwardVal, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 0 }; //For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-back", (event, response) => {
    let recent_val = parseInt(response);
    let backVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("drone back", backVal, "sent", response);
    // let val = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    // console.log("drone back", val, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 180 }; //For Vex
    sendCommand(moveCommand);
    // tello.back(val);
  });

  ipcMain.on("cw", (event, response) => {
    let recent_val = parseInt(response);
    //let val = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("cw", recent_val, "sent", response);
    tello.cw(recent_val);
  });

  ipcMain.on("ccw", (event, response) => {
    let recent_val = parseInt(response);
    //let val = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("ccw", recent_val, "sent", response);
    tello.ccw(recent_val);
  });

  // Robot movement commands
  ipcMain.on("vex-turn-left", (event, degrees) => {
    console.log(`[VEX] Turn left ${degrees}°`);
    const turnCommand = { action: "turn_left", degrees: degrees };
    sendCommand(turnCommand);
  });

  ipcMain.on("vex-turn-right", (event, degrees) => {
    console.log(`[VEX] Turn right ${degrees}°`);
    const turnCommand = { action: "turn_right", degrees: degrees };
    sendCommand(turnCommand);
  });

  ipcMain.on("vex-forward", (event, distance) => {
    console.log(`[${robotDisplayName}] Move forward ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 0 };
    sendCommand(moveCommand);
  });

  ipcMain.on("vex-back", (event, distance) => {
    console.log(`[${robotDisplayName}] Move back ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 180 };
    sendCommand(moveCommand);
  });

  ipcMain.on("vex-left", (event, distance) => {
    console.log(`[${robotDisplayName}] Move left ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 270 };
    sendCommand(moveCommand);
  });

  ipcMain.on("vex-right", (event, distance) => {
    console.log(`[${robotDisplayName}] Move right ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 90 };
    sendCommand(moveCommand);
  });

  // Robot kicker handler
  ipcMain.on("vex-kicker", (event, type) => {
    const t = String(type || "").toLowerCase();
    console.log(`[${robotDisplayName}] Kicker action: ${t}`);
    const kickCommand = { action: "kicker", type: t };
    sendCommand(kickCommand);
  });

  // Robot reconnect handler
  ipcMain.handle("vex-reconnect", async (event, mechdogNameMatch) => {
    // Guard: don't proceed if window is gone
    if (!win || win.isDestroyed()) {
      console.warn(`[${robotDisplayName}] Reconnect aborted: window destroyed`);
      return { success: false, message: "Window closed" };
    }

    console.log(`[${robotDisplayName}] Reconnect requested`);
    const result = await reconnectVEX(mechdogNameMatch);
    return result;
  });

  // Manual status request from renderer
  ipcMain.on("vex-status-request", () => pollRobotStatus());

  ipcMain.handle("mechdog-name-match-get", async () => getMechDogNameMatch());
  ipcMain.handle("mechdog-name-match-set", async (event, mechdogNameMatch) => {
    return setMechDogNameMatch(mechdogNameMatch);
  });

  let isUp = false;

  // ipcMain.on("manual-control", (event, response) => {
  //   //console.log("index", response);
  //   switch (response) {
  //     case "takeoff":
  //       isUp = true;
  //       tello.takeoff();
  //       break;
  //     case "land":
  //       isUp = true;
  //       tello.land();
  //       break;
  //     case "up":
  //       tello.up(20);
  //       break;
  //     case "down":
  //       tello.down(20);
  //       break;
  //     default:
  //       break;
  //   }
  // });

  ipcMain.on("control-signal", (event, response) => {
    /*

    if (!isUp) return 0

    let { feature, threshold } = response;

    if (feature > threshold) {
      //tello.takeoff();
      console.log("Go Up");
      tello.up(20);
    } else {
      tello.down(20);
      console.log("Go Down");
    }
    */
  });

  ipcMain.on("send-command", (event, command) => {
    console.log("Received command from renderer:", command);
    sendCommand(command); // Use the existing sendCommand function
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}

// https://electronjs.org/docs/tutorial/security#12-disable-or-limit-navigation
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (contentsEvent, navigationUrl) => {
    /* eng-disable LIMIT_NAVIGATION_JS_CHECK  */
    const parsedUrl = new URL(navigationUrl);
    const validOrigins = [selfHost];

    // Log and prevent the app from navigating to a new page if that page's origin is not whitelisted
    if (!validOrigins.includes(parsedUrl.origin)) {
      console.error(
        `The application tried to navigate to the following address: '${parsedUrl}'. This origin is not whitelisted and the attempt to navigate was blocked.`
      );

      contentsEvent.preventDefault();
    }
  });

  contents.on("will-redirect", (contentsEvent, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const validOrigins = [];

    // Log and prevent the app from redirecting to a new page
    if (!validOrigins.includes(parsedUrl.origin)) {
      console.error(
        `The application tried to redirect to the following address: '${navigationUrl}'. This attempt was blocked.`
      );

      contentsEvent.preventDefault();
    }
  });

  // https://electronjs.org/docs/tutorial/security#11-verify-webview-options-before-creation
  contents.on("will-attach-webview", (contentsEvent, webPreferences, params) => {
    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    // Disable Node.js integration
    webPreferences.nodeIntegration = false;
  });

  // https://electronjs.org/docs/tutorial/security#13-disable-or-limit-creation-of-new-windows
  // This code replaces the old "new-window" event handling;
  // https://github.com/electron/electron/pull/24517#issue-447670981
  contents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    const validOrigins = [];

    // Log and prevent opening up a new window
    if (!validOrigins.includes(parsedUrl.origin)) {
      console.error(
        `The application tried to open a new window at the following address: '${url}'. This attempt was blocked.`
      );

      return {
        action: "deny"
      };
    }

    return {
      action: "allow"
    };
  });
});

// Events
ipcMain.on("showDialog", () => {
  dialog.showMessageBoxSync({
    type: "info",
    message: "Hi I'm a dialog from Electron"
  });
});

ipcMain.on("toMain", (event, { data }) => {
  const reply = data * 2;
  event.reply("fromMain", reply);
  //win.webContents.send("fromMain", reply);
});

// Cleanup Python process on app quit
app.on("before-quit", async (e) => {
  e.preventDefault();

  // Stop status polling immediately
  if (ws) {
    try {
      ws.close();
    } catch {}
    ws = null;
  }

  if (pythonProcess) {
    console.log("Terminating Python process before quit...");
    await stopPythonServer();
  }
  app.exit(0);
});

app.on("window-all-closed", async () => {
  // Stop status polling
  if (ws) {
    try {
      ws.close();
    } catch {}
    ws = null;
  }

  if (pythonProcess) {
    console.log("Terminating Python process on window close...");
    await stopPythonServer();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Also handle process signals and exit to avoid orphaned Python server
process.on("SIGINT", () => {
  console.log("SIGINT received, stopping Python...");
  stopPythonServer().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, stopping Python...");
  stopPythonServer().finally(() => process.exit(0));
});

process.on("exit", () => {
  console.log("Process exiting, force-killing Python if needed...");
  if (pythonProcess) {
    try {
      if (isWin) {
        exec(`taskkill /F /PID ${pythonProcess.pid}`, (err) => {
          if (err) console.warn("Final taskkill failed:", err);
        });
      } else {
        pythonProcess.kill("SIGKILL");
      }
    } catch (e) {
      console.warn("Final kill failed:", e);
    }
  }
});
