const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn, exec } = require('child_process');
const path = require("path");
const fs = require("fs");
const tello = require("./tello.js");
const WebSocket = require('ws');
const waitOn = require('wait-on');

const isProduction =
  process.env.NODE_ENV === "production" || !process || !process.env || !process.env.NODE_ENV;
const isDevelopment = !isProduction;

const menu = require("./menu");
const port = 3005; // Updated to match the new port
const selfHost = `http://localhost:${port}`;
const GANGLION_DEVICE_NAME = "Ganglion-";
const maxSpeed = 40;
const minSpeed = 15;
let bleCallback = null;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let pythonProcess;
const isWin = process.platform === 'win32';
let ws = null;
let pythonForceKillTimer = null; // timeout handle for forced kill
let reconnectInProgress = false; // guard against overlapping reconnects
let robotBackend = "mechdog";
let wsRequestCounter = 0;
const pendingWsRequests = new Map();
let mechdogSelection = null;

const MECHDOG_SELECTION_PATH = path.join(app.getPath("userData"), "mechdog-selection.json");

function getRobotDisplayName() {
  if (robotBackend === "mechdog") return "MechDog";
  if (robotBackend === "tello") return "Tello";
  return "VEX AIM";
}

function usesPythonBackend() {
  return robotBackend === "vex" || robotBackend === "mechdog";
}

function loadMechDogSelection() {
  try {
    const raw = fs.readFileSync(MECHDOG_SELECTION_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.address !== "string" || !parsed.address.trim()) {
      return null;
    }
    return {
      address: parsed.address.trim(),
      name: typeof parsed.name === "string" ? parsed.name.trim() : ""
    };
  } catch {
    return null;
  }
}

function saveMechDogSelection(selection) {
  if (!selection?.address) return;
  fs.mkdirSync(path.dirname(MECHDOG_SELECTION_PATH), { recursive: true });
  fs.writeFileSync(MECHDOG_SELECTION_PATH, JSON.stringify(selection, null, 2), "utf8");
}

function getMechDogSelection() {
  if (!mechdogSelection) {
    mechdogSelection = loadMechDogSelection();
  }
  return mechdogSelection;
}

function getPythonExecutable() {
  if (isDevelopment) {
    // Development: Use virtual environment
    const venvPath = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
    console.log('[PYTHON] isDevelopment:', isDevelopment);
    console.log('[PYTHON] Checking venv python at:', venvPath, 'exists:', fs.existsSync(venvPath));
    if (fs.existsSync(venvPath)) {
      return venvPath;
    }
    console.log('[PYTHON] Falling back to system python');
    // Fallback to system python
    return 'python';
  } else {
    // Production: Use bundled executable
    console.log('[PYTHON] isProduction:', !isDevelopment);
    console.log('[PYTHON] process.resourcesPath:', process.resourcesPath);
    const exeCandidates = robotBackend === "mechdog" ? ["MechDogServer.exe", "VEXServer.exe"] : ["VEXServer.exe"];
    for (const exeName of exeCandidates) {
      const bundledExe = path.join(process.resourcesPath, 'python', exeName);
      console.log('[PYTHON] Checking bundled exe at:', bundledExe, 'exists:', fs.existsSync(bundledExe));
      if (fs.existsSync(bundledExe)) {
        console.log(`[PYTHON] Using bundled ${exeName} (standalone executable)`);
        return { exe: bundledExe, standalone: true };
      }
    }
    // Fallback to script with bundled python
    const bundledPython = path.join(process.resourcesPath, 'python', 'python.exe');
    const bundledScript = path.join(process.resourcesPath, 'python', getPythonScriptName());
    console.log('[PYTHON] Checking bundled python at:', bundledPython, 'exists:', fs.existsSync(bundledPython));
    console.log('[PYTHON] Checking bundled script at:', bundledScript, 'exists:', fs.existsSync(bundledScript));
    if (fs.existsSync(bundledPython) && fs.existsSync(bundledScript)) {
      return { exe: bundledPython, script: bundledScript };
    }
    // Final fallback
    console.warn('[PYTHON] No bundled exe or python+script found. Falling back to system python');
    return 'python';
  }
}

function getPythonScript() {
  if (isDevelopment) {
    const useMock = (process.env.VEX_MOCK === '1' || String(process.env.VEX_MOCK || '').toLowerCase() === 'true');
    const scriptName = useMock && robotBackend === "vex" ? 'VEXServer_dev.py' : getPythonScriptName();
    const devPath = path.join(__dirname, '..', '..', 'resources', 'python', scriptName);
    console.log(`[PYTHON] getPythonScript dev -> ${scriptName}:`, devPath, 'exists:', fs.existsSync(devPath));
    return devPath;
  } else {
    const prodPath = path.join(process.resourcesPath, 'python', getPythonScriptName());
    console.log('[PYTHON] getPythonScript prod path:', prodPath, 'exists:', fs.existsSync(prodPath));
    return prodPath;
  }
}

function getPythonScriptName() {
  return robotBackend === "mechdog" ? "MechDogServer.py" : "VEXServer.py";
}

async function isRobotBackendPortReady() {
  const net = require('net');
  return new Promise(res => {
    const sock = net.createConnection({ port: 8777, host: '127.0.0.1' });
    const done = (ready) => {
      try { sock.destroy(); } catch { }
      res(ready);
    };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    setTimeout(() => done(false), 300);
  });
}

async function startPythonServer() {
  if (!usesPythonBackend()) {
    console.log(`[PYTHON] ${getRobotDisplayName()} does not use the Python robot backend`);
    return;
  }

  if (pythonProcess) {
    return;
  }

  if (await isRobotBackendPortReady()) {
    console.log('[PYTHON] Reusing existing robot backend on ws://127.0.0.1:8777');
    return;
  }

  // Clear any lingering force-kill timer from a prior stop
  if (pythonForceKillTimer) {
    clearTimeout(pythonForceKillTimer);
    pythonForceKillTimer = null;
  }
  const pythonExe = getPythonExecutable();
  console.log('[PYTHON] Resolved python executable:', pythonExe);

  try {
    const spawnEnv = { ...process.env };
    if (robotBackend === "mechdog") {
      const selectedDog = getMechDogSelection();
      if (selectedDog?.address) {
        spawnEnv.MECHDOG_ADDRESS = selectedDog.address;
      }
    }

    if (typeof pythonExe === 'object') {
      if (pythonExe.standalone) {
        // Standalone exe (e.g., PyInstaller bundle) - no script argument needed
        console.log('[PYTHON] Spawning standalone exe:', pythonExe.exe);
        pythonProcess = spawn(pythonExe.exe, [], { stdio: 'pipe', env: spawnEnv });
      } else {
        // Python interpreter + script
        console.log('[PYTHON] Spawning bundled python + script:', pythonExe.exe, pythonExe.script);
        pythonProcess = spawn(pythonExe.exe, [pythonExe.script], { stdio: 'pipe', env: spawnEnv });
      }
    } else if (typeof pythonExe === 'string' && pythonExe.endsWith('.exe') && isProduction) {
      console.log('[PYTHON] Spawning bundled exe:', pythonExe);
      pythonProcess = spawn(pythonExe, [], { stdio: 'pipe', env: spawnEnv });
    } else {
      const script = getPythonScript();
      console.log('[PYTHON] Spawning:', pythonExe, script);
      pythonProcess = spawn(pythonExe, [script], { stdio: 'pipe', env: spawnEnv });
    }
  } catch (spawnErr) {
    console.error('[PYTHON] Spawn error:', spawnErr);
    return; // abort start
  }

  pythonProcess?.stdout?.on('data', (data) => console.log(`PYTHON: ${data}`));
  pythonProcess?.stderr?.on('data', (data) => console.error(`PYTHON ERROR: ${data}`));
  pythonProcess?.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null;
  });

  // Lightweight TCP poll instead of waitOn to avoid WebSocket handshake noise
  const maxAttempts = 25;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const portReady = await isRobotBackendPortReady();
    if (portReady) {
      console.log('[PYTHON] WebSocket TCP port responsive');
      break;
    }
    await new Promise(r => setTimeout(r, 200));
    if (attempt === maxAttempts) {
      console.warn('[PYTHON] WebSocket port not responsive after retries; proceeding anyway');
    }
  }
}

async function stopPythonServer() {
  console.log(`Stopping Python ${getRobotDisplayName()} server...`);
  if (!pythonProcess) {
    console.log('Python process already stopped');
    return;
  }
  return new Promise(resolve => {
    if (pythonForceKillTimer) {
      clearTimeout(pythonForceKillTimer);
      pythonForceKillTimer = null;
    }
    const proc = pythonProcess;

    // Check if process is already dead
    if (proc.exitCode !== null || proc.killed) {
      console.log('Python process already exited or killed');
      pythonProcess = null;
      resolve();
      return;
    }

    const finish = (code) => {
      if (pythonProcess === proc) pythonProcess = null;
      console.log(`Python process stopped with code ${code}`);
      resolve();
    };
    proc.once('close', finish);
    try { proc.kill('SIGTERM'); } catch (e) { console.warn('SIGTERM failed:', e); }
    pythonForceKillTimer = setTimeout(() => {
      if (pythonProcess === proc) {
        console.log('Force killing Python process (timeout)...');
        if (isWin) {
          try {
            exec(`taskkill /F /PID ${proc.pid}`, (err) => {
              if (err) console.warn('taskkill failed:', err);
            });
          } catch (e) { /* ignore */ }
        } else {
          try { proc.kill('SIGKILL'); } catch { }
        }
      }
      pythonForceKillTimer = null;
    }, 5000);
  });
}

async function stopRobotBackend() {
  if (ws) {
    try { ws.close(); } catch { }
    ws = null;
  }

  await stopPythonServer();
}

async function startRobotBackend() {
  if (!usesPythonBackend()) {
    await stopRobotBackend();
    return;
  }

  await startPythonServer();
  await createWebSocketConnection();
  if (robotBackend === "mechdog") {
    const selectedDog = getMechDogSelection();
    if (selectedDog?.address) {
      try {
        await sendWsCommand({ action: "select_device", address: selectedDog.address, name: selectedDog.name || "" });
      } catch (error) {
        console.warn("[MechDog] Failed to apply saved device selection:", error.message);
      }
    }
  }
  pollRobotStatus();
}

async function switchOutputTarget(target) {
  const nextBackend = target === "mechdog" ? "mechdog" : target === "tello" ? "tello" : target === "none" ? "none" : "vex";

  if (nextBackend === robotBackend) {
    return;
  }

  console.log(`[ROBOT] Switching output target from ${robotBackend} to ${nextBackend}`);
  await stopRobotBackend();
  robotBackend = nextBackend;
  await startRobotBackend();
}

async function reconnectVEX() {
  console.log(`Reconnecting to ${getRobotDisplayName()}...`);
  if (reconnectInProgress) {
    console.log('Reconnect skipped: already in progress');
    return { success: false, message: 'Reconnect already running' };
  }
  reconnectInProgress = true;
  try {
    // Instead of killing the Python process, just tell it to reconnect to the robot
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending reconnect_robot command to Python server...');
      ws.send(JSON.stringify({ action: 'reconnect_robot' }));

      const robotConnected = await waitForRobotConnection();
      if (robotConnected) {
        console.log(`${getRobotDisplayName()} connection confirmed`);
        return { success: true, message: `Successfully connected to ${getRobotDisplayName()}` };
      }
      return { success: false, message: `${getRobotDisplayName()} backend is running, but the device is not connected.` };
    } else {
      // WebSocket isn't connected - fall back to restarting everything
      console.log('WebSocket not connected, restarting Python server...');
      if (ws) { try { ws.close(); } catch { } ws = null; }
      await stopPythonServer();

      // Wait longer before restarting to ensure clean shutdown
      await new Promise(r => setTimeout(r, 2000));

      await startPythonServer();

      // Wait longer after Python restart for server to be fully ready
      await new Promise(r => setTimeout(r, 3000));

      // Reconnect WebSocket with retry logic (5 attempts, 2s between each)
      let wsConnected = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`WebSocket connection attempt ${attempt}/5...`);
          await createWebSocketConnection();
          wsConnected = true;
          console.log('✓ WebSocket reconnected successfully');
          break;
        } catch (err) {
          console.warn(`WebSocket reconnection attempt ${attempt} failed:`, err.message);
          if (attempt < 5) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      if (!wsConnected) {
        return { success: false, message: 'Failed to reconnect WebSocket after restarting Python server (5 attempts)' };
      }

      console.log(`Local ${getRobotDisplayName()} server reconnected; checking device connection...`);
      const robotConnected = await waitForRobotConnection();
      if (robotConnected) {
        return { success: true, message: `Successfully connected to ${getRobotDisplayName()}` };
      }
      return { success: false, message: `Local ${getRobotDisplayName()} server restarted, but the device is not connected.` };
    }
  } catch (error) {
    console.error(`Failed to reconnect to ${getRobotDisplayName()}:`, error);
    return { success: false, message: `Reconnection failed: ${error.message}` };
  } finally {
    reconnectInProgress = false;
  }
}

function waitForRobotConnection(timeoutMs = 30000) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      resolve(false);
      return;
    }

    let interval;
    let timeout;
    const cleanup = () => {
      clearInterval(interval);
      clearTimeout(timeout);
      ws?.removeListener('message', onMessage);
    };
    const finish = (connected) => {
      cleanup();
      resolve(connected);
    };
    const onMessage = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.robot_connected === true ||
            (msg.type === 'welcome' && msg.status?.robot_connected === true)) {
          finish(true);
        } else if (msg.status === 'error' ||
                   (robotBackend === 'mechdog' &&
                    msg.action === 'reconnect_robot' &&
                    msg.robot_connected === false)) {
          finish(false);
        }
      } catch { /* ignore unrelated messages */ }
    };
    const requestStatus = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        finish(false);
        return;
      }
      ws.send(JSON.stringify({ action: 'status' }));
    };

    ws.on('message', onMessage);
    interval = setInterval(requestStatus, 500);
    timeout = setTimeout(() => finish(false), timeoutMs);
    requestStatus();
  });
}

function createWebSocketConnection() {
  return new Promise((resolve, reject) => {
    let wsTimeout;
    try {
      ws = new WebSocket('ws://127.0.0.1:8777');

      ws.on('open', function open() {
        console.log('WebSocket connection opened');
        clearTimeout(wsTimeout);
        attachStatusListener();
        resolve();
      });

      ws.on('error', function error(err) {
        console.error('WebSocket error:', err.message);
        clearTimeout(wsTimeout);
        reject(err);
      });

      ws.on('close', function close() {
        console.log('WebSocket connection closed');
        rejectPendingWsRequests('Robot backend connection closed');
        win?.webContents.send('vex-status', {
          wsConnected: false,
          robotConnected: false,
          backend: robotBackend
        });
      });

      // Increase timeout to 10 seconds and add detailed logging
      wsTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket connection timeout after 10s, terminating...');
          try { ws.terminate?.(); } catch { }
          reject(new Error('WebSocket connection timeout (10s)'));
        }
      }, 10000);
    } catch (error) {
      clearTimeout(wsTimeout);
      reject(error);
    }
  });
}

function sendWsCommand(command, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("Robot backend is not connected"));
      return;
    }

    const request_id = `req-${Date.now()}-${++wsRequestCounter}`;
    const payload = { ...command, request_id };
    const timer = setTimeout(() => {
      pendingWsRequests.delete(request_id);
      reject(new Error(`Timed out waiting for backend response to ${command.action || "request"}`));
    }, timeoutMs);

    pendingWsRequests.set(request_id, {
      resolve: (message) => {
        clearTimeout(timer);
        resolve(message);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      }
    });

    try {
      ws.send(JSON.stringify(payload));
    } catch (error) {
      clearTimeout(timer);
      pendingWsRequests.delete(request_id);
      reject(error);
    }
  });
}

function rejectPendingWsRequests(reason) {
  for (const [requestId, handlers] of pendingWsRequests.entries()) {
    handlers.reject(new Error(reason));
    pendingWsRequests.delete(requestId);
  }
}

// --- Status helpers ---
function attachStatusListener() {
  if (!ws) return;
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.request_id && pendingWsRequests.has(msg.request_id)) {
        const handlers = pendingWsRequests.get(msg.request_id);
        pendingWsRequests.delete(msg.request_id);
        handlers.resolve(msg);
      }

      const currentSelection = getMechDogSelection();
      if (msg.robot_connected !== undefined) {
        win?.webContents.send('vex-status', {
          wsConnected: true,
          robotConnected: !!msg.robot_connected,
          backend: robotBackend,
          battery: msg.battery,
          sonarDistanceMm: msg.sonar_distance_mm,
          deviceName: msg.device_name,
          deviceAddress: msg.device_address,
          selectedDeviceName: currentSelection?.name || msg.device_name,
          selectedDeviceAddress: currentSelection?.address || msg.device_address,
          lastError: msg.last_error
        });
      } else if (msg.type === "welcome" && msg.status) {
        win?.webContents.send('vex-status', {
          wsConnected: true,
          robotConnected: !!msg.status.robot_connected,
          backend: robotBackend,
          battery: msg.status.battery,
          sonarDistanceMm: msg.status.sonar_distance_mm,
          deviceName: msg.status.device_name,
          deviceAddress: msg.status.device_address,
          selectedDeviceName: currentSelection?.name || msg.status.device_name,
          selectedDeviceAddress: currentSelection?.address || msg.status.device_address,
          lastError: msg.status.last_error
        });
      } else if (msg.action === "battery" || msg.action === "sonar") {
        win?.webContents.send('vex-status', {
          wsConnected: true,
          backend: robotBackend,
          battery: msg.battery,
          sonarDistanceMm: msg.distance_mm
        });
      } else if (msg.action === "select_device") {
        win?.webContents.send('vex-status', {
          wsConnected: true,
          backend: robotBackend,
          robotConnected: !!msg.robot_connected,
          selectedDeviceName: msg.device_name,
          selectedDeviceAddress: msg.device_address,
          deviceName: msg.device_name,
          deviceAddress: msg.device_address
        });
      }
    } catch { /* ignore */ }
  });
}

function pollRobotStatus() {
  // Guard: skip if WebSocket not ready OR window destroyed
  if (!ws || ws.readyState !== WebSocket.OPEN || !win || win.isDestroyed()) {
    return;
  }
  try {
    ws.send(JSON.stringify({ action: 'status' }));
  } catch (err) {
    console.warn('Failed to poll status:', err);
  }
}

function pollRobotTelemetry() {
  if (robotBackend !== "mechdog" || !ws || ws.readyState !== WebSocket.OPEN || !win || win.isDestroyed()) {
    return;
  }

  try {
    ws.send(JSON.stringify({ action: "battery" }));
    ws.send(JSON.stringify({ action: "sonar" }));
  } catch (err) {
    console.warn("Failed to poll MechDog telemetry:", err);
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
    title: `NeuroBlock EMG for ${getRobotDisplayName()}`,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  // Add the event listener here, AFTER creating the window
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Window failed to load:', errorDescription);
  });

  // Load the url of the dev server if in development mode
  // Load the index.html when not in development
  if (isDevelopment) {
    win.loadURL(selfHost);
  } else {
    win.loadFile(path.join(__dirname, "../../build/renderer/index.html"));
  }

  // Only do these things when in development
  if (isDevelopment) {
    // Reload
    try {
      require("electron-reloader")(module);
    } catch (_) { }
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
      try { ws.close(); } catch { }
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
    if (robotBackend !== "tello") {
      return;
    }
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

  function parseCommandNumber(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clampTelloMove(value) {
    const parsed = parseCommandNumber(value, minSpeed);
    return Math.max(minSpeed, Math.min(maxSpeed, parsed));
  }

  function sendTelloCommand(command) {
    const action = String(command && command.action ? command.action : "").toLowerCase();

    if (action === "move") {
      const heading = Number(command.heading);
      const distance = clampTelloMove(command.distance);

      if (heading === 0) tello.forward(distance);
      else if (heading === 180) tello.back(distance);
      else if (heading === 90) tello.right(distance);
      else if (heading === 270) tello.left(distance);
      else console.warn("[Tello] Unsupported move heading:", command);
      return;
    }

    if (action === "turn_left") {
      tello.ccw(parseCommandNumber(command.degrees, 90));
      return;
    }

    if (action === "turn_right") {
      tello.cw(parseCommandNumber(command.degrees, 90));
      return;
    }

    if (action === "takeoff") {
      tello.takeoff();
      return;
    }

    if (action === "land") {
      tello.land();
      return;
    }

    console.warn("[Tello] Unsupported command:", command);
  }

  function sendCommand(command) {
    if (robotBackend === "none") {
      console.warn("No output target selected; ignoring command:", command);
      return;
    }

    if (robotBackend === "tello") {
      sendTelloCommand(command);
      return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(command));
      console.log("Command sent:", command);
    } else {
      console.error('WebSocket not connected, cannot send command:', command);
    }
  }

  // Initialize WebSocket connection
  startRobotBackend().catch(err => {
    console.error('Failed to establish initial robot backend connection:', err);
  });

  // Periodic status polling - but clear it when window closes
  const statusInterval = setInterval(pollRobotStatus, 3000);
  const telemetryInterval = setInterval(pollRobotTelemetry, 1000);
  // NOTE: win.on("closed") handler is already defined above in createWindow()

  ipcMain.on("drone-up", (event, response) => {
    let rightVal = clampTelloMove(response);
    console.log("drone right", rightVal, "sent", response);
    if (robotBackend === "tello") {
      tello.right(rightVal);
      return;
    }
    const moveCommand = { action: "move", distance: parseCommandNumber(response, 4), heading: 90 };//For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-down", (event, response) => {
    let downVal = clampTelloMove(response);
    console.log("drone left", downVal, "sent", response);
    if (robotBackend === "tello") {
      tello.left(downVal);
      return;
    }
    const moveCommand = { action: "move", distance: parseCommandNumber(response, 4), heading: 270 };//For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-forward", (event, response) => {
    let forwardVal = clampTelloMove(response);
    console.log("drone forward", forwardVal, "sent", response);
    if (robotBackend === "tello") {
      tello.forward(forwardVal);
      return;
    }
    const moveCommand = { action: "move", distance: parseCommandNumber(response, 4), heading: 0 };//For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-back", (event, response) => {
    let backVal = clampTelloMove(response);
    console.log("drone back", backVal, "sent", response);
    if (robotBackend === "tello") {
      tello.back(backVal);
      return;
    }
    // let val = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    // console.log("drone back", val, "sent", response);
    const moveCommand = { action: "move", distance: parseCommandNumber(response, 4), heading: 180 };//For Vex
    sendCommand(moveCommand);
    // tello.back(val);
  });

  ipcMain.on("cw", (event, response) => {
    let recent_val = parseCommandNumber(response, 90);
    //let val = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("cw", recent_val, "sent", response);
    if (robotBackend === "tello") {
      tello.cw(recent_val);
      return;
    }
    sendCommand({ action: "turn_right", degrees: recent_val });
  });

  ipcMain.on("ccw", (event, response) => {
    let recent_val = parseCommandNumber(response, 90);
    //let val = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("ccw", recent_val, "sent", response);
    if (robotBackend === "tello") {
      tello.ccw(recent_val);
      return;
    }
    sendCommand({ action: "turn_left", degrees: recent_val });
  });

  //Vex commands
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
    console.log(`[VEX] Move forward ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 0 };
    sendCommand(moveCommand);
  });

  ipcMain.on("vex-back", (event, distance) => {
    console.log(`[VEX] Move back ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 180 };
    sendCommand(moveCommand);
  });

  ipcMain.on("vex-left", (event, distance) => {
    console.log(`[VEX] Move left ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 270 };
    sendCommand(moveCommand);
  });

  ipcMain.on("vex-right", (event, distance) => {
    console.log(`[VEX] Move right ${distance} inches`);
    const moveCommand = { action: "move", distance: distance, heading: 90 };
    sendCommand(moveCommand);
  });

  // VEX kicker handler
  ipcMain.on("vex-kicker", (event, type) => {
    const t = String(type || "").toLowerCase();
    console.log(`[VEX] Kicker action: ${t}`);
    const kickCommand = { action: "kicker", type: t };
    sendCommand(kickCommand);
  });

  // VEX Reconnect handler
  ipcMain.handle("vex-reconnect", async (event) => {
    // Guard: don't proceed if window is gone
    if (!win || win.isDestroyed()) {
      console.warn(`[${getRobotDisplayName()}] Reconnect aborted: window destroyed`);
      return { success: false, message: 'Window closed' };
    }

    console.log(`[${getRobotDisplayName()}] Reconnect requested`);
    const result = await reconnectVEX();
    return result;
  });

  // Manual status request from renderer
  ipcMain.on('vex-status-request', () => pollRobotStatus());

  ipcMain.handle("mechdog-scan", async () => {
    if (robotBackend !== "mechdog") {
      await switchOutputTarget("mechdog");
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("MechDog backend is not connected");
    }

    const response = await sendWsCommand({ action: "scan_devices", timeout: 6.0 }, 15000);
    if (response.status !== "success") {
      throw new Error(response.message || "Failed to scan for MechDogs");
    }
    return response.devices || [];
  });

  ipcMain.handle("mechdog-select", async (event, device) => {
    const address = String(device?.address || "").trim();
    const name = String(device?.name || "").trim();
    if (!address) {
      throw new Error("A MechDog address is required");
    }

    if (robotBackend !== "mechdog") {
      await switchOutputTarget("mechdog");
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("MechDog backend is not connected");
    }

    const response = await sendWsCommand({ action: "select_device", address, name });
    if (response.status !== "success") {
      throw new Error(response.message || "Failed to select MechDog");
    }

    mechdogSelection = { address, name };
    saveMechDogSelection(mechdogSelection);
    await reconnectVEX();
    pollRobotStatus();

    return { success: true, address, name };
  });

  ipcMain.handle("mechdog-get-selection", () => getMechDogSelection());

  ipcMain.on("set-output-target", (event, target) => {
    switchOutputTarget(String(target || "vex")).catch((error) => {
      console.error("Failed to switch output target:", error);
    });
  });

  let isUp = false;

  ipcMain.on("manual-control", (event, response) => {
    const command = String(response || "").toLowerCase();

    if (command === "takeoff") {
      isUp = true;
      sendCommand({ action: "takeoff" });
      return;
    }

    if (command === "land") {
      isUp = false;
      sendCommand({ action: "land" });
      return;
    }

    console.warn("Unsupported manual control command:", response);
  });

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
app.on('before-quit', async (e) => {
  e.preventDefault();

  // Stop status polling immediately
  if (ws) {
    try { ws.close(); } catch { }
    ws = null;
  }

  if (pythonProcess) {
    console.log('Terminating Python process before quit...');
    await stopPythonServer();
  }
  app.exit(0);
});

app.on('window-all-closed', async () => {
  // Stop status polling
  if (ws) {
    try { ws.close(); } catch { }
    ws = null;
  }

  if (pythonProcess) {
    console.log('Terminating Python process on window close...');
    await stopPythonServer();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Also handle process signals and exit to avoid orphaned Python server
process.on('SIGINT', () => {
  console.log('SIGINT received, stopping Python...');
  stopPythonServer().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping Python...');
  stopPythonServer().finally(() => process.exit(0));
});

process.on('exit', () => {
  console.log('Process exiting, force-killing Python if needed...');
  if (pythonProcess) {
    try {
      if (isWin) {
        exec(`taskkill /F /PID ${pythonProcess.pid}`, (err) => {
          if (err) console.warn('Final taskkill failed:', err);
        });
      } else {
        pythonProcess.kill('SIGKILL');
      }
    } catch (e) { console.warn('Final kill failed:', e); }
  }
});
