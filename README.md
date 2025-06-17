# Neuroscope

This project builds on [this boiler plate](https://github.com/a133xz/electron-vuejs-parcel-boilerplate) and adds functionality to control a Sphero Bolt using WebSocket commands.

## Getting Started

### Prerequisites

- Node.js
- npm or yarn
- Python 3.x
- `websockets` Python package

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/neuroscope.git
    cd neuroscope
    ```

2. Install the dependencies:
    ```sh
    yarn install
    ```

3. Start the Sphero server:
    ```sh
    python SpheroServer.py
    ```

4. Start the Electron application:
    ```sh
    yarn serve
    ```

## Usage

### Controlling the Sphero

The application sends WebSocket commands to control the Sphero Bolt. The following commands are available:

- **drone-up**: Moves the Sphero up.
- **drone-down**: Moves the Sphero down.
- **drone-forward**: Moves the Sphero forward.

### Code Changes

The main changes are in the `index.js` file:

1. **WebSocket Setup**:
    ```javascript
    const WebSocket = require('ws');
    const ws = new WebSocket('ws://localhost:8765');

    ws.on('open', function open() {
      console.log('WebSocket connection opened');
    });

    ws.on('error', function error(err) {
      console.error('WebSocket error:', err);
    });
    ```

2. **Command Sending with Debounce**:
    ```javascript
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
    ```

3. **IPC Event Handlers**:
    ```javascript
    ipcMain.on("drone-up", (event, response) => {
      let recent_val = parseInt(response);
      let upVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
      console.log("drone up", upVal, "sent", response);
      const moveCommand = { action: "move", heading: 0, speed: upVal, duration: 1 };
      sendCommand(moveCommand);
    });

    ipcMain.on("drone-down", (event, response) => {
      let recent_val = parseInt(response);
      let downVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
      console.log("drone down", downVal, "sent", response);
      const moveCommand = { action: "move", heading: 180, speed: downVal, duration: 1 };
      sendCommand(moveCommand);
    });

    ipcMain.on("drone-forward", (event, response) => {
      let recent_val = parseInt(response);
      let forwardVal = recent_val > maxSpeed ? maxSpeed : recent_val < minSpeed ? minSpeed : recent_val;
      console.log("drone forward", forwardVal, "sent", response);
      const moveCommand = { action: "move", heading: 90, speed: forwardVal, duration: 1 };
      sendCommand(moveCommand);
    });
    ```

## Work in Progress

This project is a work in progress. The current implementation allows basic control of the Sphero Bolt using WebSocket commands. Further improvements and features are planned for future updates.
