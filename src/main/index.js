const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn } = require('child_process');
const path = require("path");
const tello = require("./tello.js");
const WebSocket = require('ws');
const waitOn = require('wait-on');

const isProduction =
  process.env.NODE_ENV === "production" || !process || !process.env || !process.env.NODE_ENV;
const isDevelopment = !isProduction;

const menu = require("./menu");
const port = 3000; // Hardcoded; needs to match webpack.development.js and package.json
const selfHost = `http://localhost:${port}`;
const MUSE_DEVICE_NAME = "Muse-98A9";
const maxSpeed = 40;
const minSpeed = 15;
let bleCallback = null;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let pythonProcess;

async function createWindow() {
  // ---- Start Python VEXServer ----
  const pythonExe = 'python'; // or full path to python if not in PATH
  const script = path.join(__dirname, '..', '..', 'resources', 'python', 'VEXServer.py');
  pythonProcess = spawn(pythonExe, [script]);

  pythonProcess.stdout.on('data', (data) => {
    console.log(`PYTHON: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`PYTHON ERROR: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });
  // ---- End Python VEXServer ----

  // Wait for the Python WebSocket server to be ready (up to 10 seconds)
  await waitOn({ resources: ['tcp:127.0.0.1:8765'], timeout: 10000 });

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
    win.loadURL(`file://${path.join(__dirname, "../../build/renderer/index.html")}`);
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
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  /*-------*/

  /* Code to integrate BLE and Tello Drone */

  // Electron native event listener for selecting a bluetooth device
  // Purpose of this function is to get the callback function and send the device list to the renderer
  win.webContents.on("select-bluetooth-device", (event, deviceList, callback) => {
    console.log("select-bluetooth-device");
    bleCallback = callback;
    event.preventDefault();
    console.log(deviceList);
    win.webContents.send("device_list", deviceList);

    let result = null;

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
    let drone_state = tello.getState();
    win.webContents.send("drone_state", drone_state);
  }, 5000);

  // This function triggers the connection to the selected BLE device
  ipcMain.on("select-ble-device", (event, selected_ble_device) => {
    console.log("device selected: ", selected_ble_device);
    if (bleCallback) {
      bleCallback(selected_ble_device);
    }
  });

  const ws = new WebSocket('ws://127.0.0.1:8765');

  ws.on('open', function open() {
    console.log('WebSocket connection opened');
  });

  ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
  });

  let lastCommandTime = 0;
  const commandInterval = 3000; // 3 seconds

  function sendCommand(command) {
    const currentTime = Date.now();
    if (currentTime - lastCommandTime >= commandInterval) {
      ws.send(JSON.stringify(command));
      console.log("Command sent:", command);
      lastCommandTime = currentTime;
    } else {
      console.log("Command skipped to avoid spamming:", command);
    }
  }

  ipcMain.on("drone-up", (event, response) => {
    let recent_val = parseInt(response);
    let rightVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("Sphero right", rightVal, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 90 };//For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-down", (event, response) => {
    let recent_val = parseInt(response);
    let downVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("Sphero Left", downVal, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 270 };//For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-forward", (event, response) => {
    let recent_val = parseInt(response);
    let forwardVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("drone forward", forwardVal, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 0 };//For Vex
    sendCommand(moveCommand);
  });

  ipcMain.on("drone-back", (event, response) => {
    let recent_val = parseInt(response);
    let backVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    console.log("drone back", backVal, "sent", response);
    // let val = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
    // console.log("drone back", val, "sent", response);
    const moveCommand = { action: "move", distance: response, heading: 180 };//For Vex
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

  javascriptGenerator.forBlock["move"] = function (block) {
    var distance = block.getFieldValue("DISTANCE");
    var heading = block.getFieldValue("HEADING");
    var code = `electronAPI.sendCommand({ action: "move", distance: ${distance}, heading: ${heading} });\n`;
    console.log("Generated code for move block:", code);
    return code;
  };

  javascriptGenerator.forBlock["led_control"] = function (block) {
    var color = block.getFieldValue("COLOR");
    var code = `electronAPI.sendCommand({ action: "led_on", color: "${color}" });\n`;
    console.log("Generated code for LED block:", code);
    return code;
  };
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
