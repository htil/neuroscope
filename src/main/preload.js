const { contextBridge, ipcRenderer } = require("electron");

process.once("loaded", () => {
  contextBridge.exposeInMainWorld("electron", {
    send: (channel, data) => {
      // whitelist channels
      let validChannels = ["toMain", "showDialog"];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ["fromMain"];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    }
  });

  contextBridge.exposeInMainWorld("electronAPI", {
    manualControl: (command) => ipcRenderer.send("manual-control", command),
    controlSignal: (response) => ipcRenderer.send("control-signal", response),
    droneUp: (response) => ipcRenderer.send("drone-up", response),
    droneDown: (response) => ipcRenderer.send("drone-down", response),
    droneForward: (response) => ipcRenderer.send("drone-forward", response),
    droneBack: (response) => ipcRenderer.send("drone-back", response),
    //Vex commands
    vexTurnLeft: (degrees) => ipcRenderer.send("vex-turn-left", degrees),
    vexTurnRight: (degrees) => ipcRenderer.send("vex-turn-right", degrees),
    vexForward: (distance) => ipcRenderer.send("vex-forward", distance),
    vexBack: (distance) => ipcRenderer.send("vex-back", distance),
    vexLeft: (distance) => ipcRenderer.send("vex-left", distance),
    vexRight: (distance) => ipcRenderer.send("vex-right", distance),
    // Kicker command IPC bridge
    vexKicker: (type) => ipcRenderer.send("vex-kicker", type),
    vexReconnect: () => ipcRenderer.invoke("vex-reconnect"),
    // VEX status IPC
    onVexStatus: (callback) => {
      if (typeof callback === 'function') {
        ipcRenderer.on('vex-status', (event, status) => callback(status));
      }
    },
    requestVexStatus: () => ipcRenderer.send('vex-status-request'),
    cw: (response) => ipcRenderer.send("cw", response),
    ccw: (response) => ipcRenderer.send("ccw", response),
    getBLEList: (callback) => ipcRenderer.on("device_list", callback),
    getDroneState: (callback) => ipcRenderer.on("drone_state", callback),
    selectBluetoothDevice: (deviceID) => ipcRenderer.send("select-ble-device", deviceID),
    cancelBluetoothRequest: (callback) => ipcRenderer.send("cancel-bluetooth-request", callback),
    bluetoothPairingRequest: (callback) => ipcRenderer.on("bluetooth-pairing-request", callback),
    bluetoothPairingResponse: (response) => ipcRenderer.send("bluetooth-pairing-response", response),
    // Expose sendCommand to the renderer process
    sendCommand: (command) => ipcRenderer.send("send-command", command),
  });
});
