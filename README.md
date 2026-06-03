# Neuroscope

Neuroscope is an Electron-based application for real-time EEG/BCI signal visualization, feature extraction, and device connectivity using Bluetooth-enabled headsets like **OpenBCI Ganglion**. It features a Blockly-based visual programming interface for custom workflows and supports VEX and Ganglion devices.

---

## Features

- **EEG Device Support:** Connect to OpenBCI Ganglion headsets via Bluetooth.
- **Real-Time Visualization:** View EEG and telemetry data live.
- **Blockly Programming:** Drag-and-drop blocks for custom signal processing and logic.
- **Extensible:** Easily add new blocks or device integrations.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14+ recommended)
- npm or yarn
- Python 3.x (for some optional features)
- Python package: `websockets` (optional, only if using WebSocket features)
- A supported EEG device (OpenBCI Ganglion)

### Installation

1. **Clone the repository:**
    ```sh
    git clone https://github.com/yourusername/neuroscope.git
    cd neuroscope
    ```

2. **Install Node dependencies:**
    ```sh
    yarn install
    # or
    npm install
    ```

3. *(Optional, only if using Python WebSocket features)*  
   **Install Python dependencies:**
    ```sh
    pip install websockets
    ```

---

## Running the Application

1. **Start the Electron Application**
    ```sh
    yarn serve
    # or
    npm run serve
    ```

    This will launch the Electron app. In development mode, it will open with hot-reloading and developer tools enabled.

2. **Connect Your EEG Device**
    - Click the **Bluetooth** button in the UI.
    - Select your **Ganglion** device from the list.
    - Wait for the connection confirmation.

---

## Usage

- **Signal Visualization:**  
  EEG channels are displayed in real time. You can view raw and filtered signals, as well as extracted features (alpha, beta, etc.).

- **Blockly Programming:**  
  Use the Blockly interface to create custom workflows. Drag and drop blocks for signal processing and feature extraction.

---

## Troubleshooting

- **Bluetooth Issues:**  
  Make sure your Ganglion device is powered on and not paired with another app. On Windows, you may need to grant Bluetooth permissions.
- **Missing Dependencies:**  
  If you see errors about missing modules, re-run `yarn install` or `npm install`.
- **Electron Fails to Start:**  
  Make sure you are using a compatible Node.js version and have all dependencies installed.

---

## Development

- **Hot Reload:**  
  The app reloads automatically in development mode.
- **Main Process:**  
  See `src/main/index.js` for Electron main process logic.
- **Renderer Process:**  
  See `src/renderer/js/` for UI and signal processing code.
- **Blockly Blocks:**  
  Custom blocks are defined in `src/renderer/js/customblock.js`.

---

## Adding a New Blockly Block (Example: VEX Kicker)

Below is the standard end-to-end pattern for introducing a new action block that can run both inside the js-interpreter (live run) and via generated JavaScript.

### 1. Define the Block (UI + Generator)
File: `src/renderer/js/customblock.js`

Add JSON spec and a generator. Example:

```javascript
// Block definition
var vexKicker = {
  type: "vex_kicker",
  message0: "kicker %1",
  args0: [
    { type: "field_dropdown", name: "ACTION", options: [
      ["Kick Hard", "HARD"],
      ["Kick Soft", "SOFT"],
      ["Place", "PLACE"]
    ]}
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_kicker"] = { init() { this.jsonInit(vexKicker); } };

javascriptGenerator.forBlock["vex_kicker"] = function(block){
  const action = block.getFieldValue("ACTION").toLowerCase();
  return `vex_kicker("${action}");\n`;
};
```

Why call `vex_kicker(...)`? Because wrapper functions are exposed to BOTH generated code and interpreter, keeping one unified runtime path.

### 2. Add Block to a Category
File: `src/renderer/js/categories.js`

Insert the block name in the appropriate category `modules` array (e.g. `cat_vex`).

```javascript
  cat_vex: {
    name: "VEX",
    colour: 70,
    modules: [ "vex_forward", "vex_back", "vex_left", "vex_right", "vex_kicker", "vex_turn_left", "vex_turn_right" ]
  }
```

### 3. Provide a Wrapper Function
File: `src/renderer/js/wrapper-functions.js`

Create a method inside `WrapperFunctions`:

```javascript
vex_kicker(kind){
  const k = String(kind||"").toLowerCase();
  if(window.electronAPI?.vexKicker){
    window.electronAPI.vexKicker(k);
  } else {
    window.electronAPI.sendCommand({ action:"kicker", type:k });
  }
}
```

### 4. Expose Wrapper in Interpreter
File: `src/renderer/js/interpreter-api.js`

Add it to `nativeFunctions`:

```javascript
vex_kicker: this.wrapperFunctions.vex_kicker,
```

### 5. IPC Bridge (Renderer → Main)
File: `src/main/preload.js`

Expose a safe function:

```javascript
vexKicker: (type) => ipcRenderer.send("vex-kicker", type),
```

### 6. Main Process Handler
File: `src/main/index.js`

Listen and forward to Python server:

```javascript
ipcMain.on("vex-kicker", (event, type) => {
  const t = String(type||"").toLowerCase();
  console.log(`[VEX] Kicker action: ${t}`);
  sendCommand({ action:"kicker", type:t });
});
```

### 7. Python Server Action (If New Action Not Yet Supported)
File: `resources/python/VEXServer.py`

Add an `elif action == "kicker":` block parsing `type` and invoking underlying AIM API (`robot.kicker.kick(...)` or `robot.kicker.place()`).

### 8. Test
1. Run `yarn serve`.
2. Drag the new block into the workspace.
3. Run the program.
4. Watch terminal for `[VEX] Kicker action: hard` and Python side confirmation.

### Summary Flow
Block → Generator → Wrapper → Interpreter (or generated JS) → `electronAPI.vexKicker` → IPC → Main → WebSocket → Python → Robot.

---

## Building a Distribution (Production Build)

The project ships JavaScript (Electron + Vue) and a Python WebSocket server (VEXServer). The bundled installer needs both.

### Prerequisites
1. Node/Yarn installed.
2. Python 3.x installed.
3. Virtual environment `.venv` created (recommended):
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Build Steps

You can run each step or use the shortcut:

| Step | Script | Purpose |
|------|--------|---------|
| 1 | `yarn build` | Builds renderer (Parcel) into `build/renderer` |
| 2 | `yarn python:build` | PyInstaller builds `dist/VEXServer.exe` from `VEXServer.spec` |
| 3 | `yarn electron:build` | Uses `electron-builder` to package the app (looks at `package.json` build config) |
| All-in-one | `yarn build:local` | Runs 1+2+3 sequentially |

Recommended single command:

```powershell
yarn build:local
```

### Output Locations
- Electron build artifacts: `dist/` (depends on electron-builder target; on Windows an unpacked dir plus resources)
- Python binary: `dist/VEXServer.exe` (copied into final app via `extraResources` in `package.json`)

### Changing Product/App Name
Edit in `package.json`:
```json
"name": "vex-emg-control",
"build": { "productName": "VEX EMG Control", "appId": "com.htlab.vex-emg-control" }
```
Optionally set BrowserWindow title in `src/main/index.js`:
```javascript
title: "VEX EMG Control"
```

### Signing / Distribution (Future)
- For Windows code-signing, add certificate config to `electron-builder`.
- For auto-update, integrate a release server (GitHub Releases or custom). Not yet configured here.

### Common Build Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| Python exe missing | PyInstaller failed | Activate venv & rerun `yarn python:build` |
| WebSocket not connecting | Robot not reachable | Confirm network / IP (AP mode `192.168.4.1`) |
| Port 3002 already used | Stale dev process | Kill previous Electron/Parcel instance |

### Known MechDog Issues
- MechDog selection currently uses a Bluetooth name fragment, so a numeric-only value like `60` can match unrelated BLE devices whose names contain the same number. This can cause the backend to connect to a non-MechDog device. The selector needs stricter filtering before classroom use with many BLE devices nearby.

### Quick Test After Build
1. Run the packaged app from `dist/`.
2. Observe Python server starts (console log: `Python WebSocket server is ready`).
3. Drag a block (e.g., `vex_forward`) and run; confirm log output and robot motion.

---

## Contributing

1. Fork & branch: `feat/new-block`.
2. Add block + wrapper + IPC.
3. Add docs section if introducing a new device pattern.
4. Run `yarn serve` and test.
5. Open PR.

---

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [OpenBCI Ganglion](https://shop.openbci.com/products/ganglion-board)
- [Blockly](https://developers.google.com/blockly)
- [Electron](https://www.electronjs.org/)

---
