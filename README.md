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

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [OpenBCI Ganglion](https://shop.openbci.com/products/ganglion-board)
- [Blockly](https://developers.google.com/blockly)
- [Electron](https://www.electronjs.org/)

---