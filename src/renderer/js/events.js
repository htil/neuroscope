//import { SessionLineGraph } from "./session.js";
//import { BlocklyMain } from "./blockly-main.js";
import * as Blockly from "blockly/core";

export const Events = class {
  constructor(blockly) {
    this.blockly = blockly;
    this.session_graph = {};

    /* Blockly Events */

    this.create_event("run", this.execute_code.bind(this));
    this.create_event("saveFile", this.download_code.bind(this));
    this.create_event("exportCode", this.export_text_code.bind(this));
    this.load_input = this.eById("file_handler");

    let handleOnChangeUpload = (e) => {
      let file = e.target.files[0];
      if (!file) {
        return;
      }
      this.loadProject(file);
    };

    this.load_input.onchange = handleOnChangeUpload.bind(this);

    this.create_event("uploadFile", () => {
      console.log("upload");
      this.load_input.click();
    });

    this.create_event("stopButton", this.stop_program.bind(this));
    this.create_event("vex-reconnect", this.reconnect_vex.bind(this));
    this.create_event("mechdog-select", this.open_mechdog_selector.bind(this));
    this.create_event("mechdog-scan", this.scan_mechdogs.bind(this));
    this.isMechDogScanning = false;

    window.electronAPI.getDroneState((event, drone_state) => {
      console.log(drone_state);
      if (drone_state.bat) {
        document.getElementById("battery").innerHTML = drone_state.bat + "%";
      }
    });

    // Local store
    //this.create_event("start_local_store", this.start_local_store.bind(this));
    //this.create_event("drone_takeoff", this.takeoff_drone.bind(this));
    //this.create_event("drone_up", this.drone_up.bind(this));
    //this.create_event("drone_down", this.drone_down.bind(this));
    //this.create_event("drone_land", this.drone_land.bind(this));
  }

  eById = (id) => {
    let res = document.getElementById(id);
    if (res == null) throw new Error("Could not find element with ID: " + id);
    return res;
  };

  create_event(id, _func) {
    document.getElementById(id).onclick = _func;
  }

  loadProject(file) {
    this.blockly.workspace.clear();
    this.blockly.workspace.clearUndo();

    let reader = new FileReader();

    reader.onload = (e) => {
      let contents = e.target.result.toString();
      let as_xml = Blockly.utils.xml.textToDom(contents);
      Blockly.Xml.domToWorkspace(as_xml, this.blockly.workspace);
    };

    reader.readAsText(file);
  }

  stop_program() {
    this.blockly.stop();
    window.electronAPI.manualControl("land");
  }

  update_mechdog_selection_label(device) {
    const selectButton = document.getElementById("mechdog-select");
    const addressInput = document.getElementById("mechdog-selected-address");
    const labelText = device?.address
      ? `${device.name || "MechDog"} (${device.address})`
      : "No MechDog selected";

    if (selectButton) {
      selectButton.title = device?.address ? `Choose MechDog: ${labelText}` : "Choose a MechDog";
    }
    if (addressInput) {
      addressInput.value = labelText;
    }
  }

  render_mechdog_devices(devices) {
    const list = document.getElementById("mechdog-device-list");
    const status = document.getElementById("mechdog-scan-status");
    if (!list || !status) return;

    if (!Array.isArray(devices) || devices.length === 0) {
      list.innerHTML = "";
      status.className = "ui small warning message";
      status.textContent = "No nearby MechDogs were found. Make sure they are powered on.";
      return;
    }

    status.className = "ui small positive message";
    status.textContent = `Found ${devices.length} MechDog${devices.length === 1 ? "" : "s"}. Choose one below.`;
    list.innerHTML = devices.map((device) => `
      <div class="item mechdog-device-item" data-address="${device.address}" data-name="${device.name || ""}">
        <i class="bluetooth icon"></i>
        <div class="content">
          <div class="header">${device.name || "MechDog"}</div>
          <div class="description">${device.address}${device.rssi ?? device.rssi === 0 ? ` | RSSI ${device.rssi}` : ""}</div>
        </div>
      </div>
    `).join("");

    list.querySelectorAll(".mechdog-device-item").forEach((item) => {
      item.addEventListener("click", () => {
        this.select_mechdog({
          address: item.dataset.address,
          name: item.dataset.name
        });
      });
    });
  }

  async open_mechdog_selector() {
    try {
      const selected = await window.electronAPI.getSelectedMechDog();
      this.update_mechdog_selection_label(selected);
    } catch {
      this.update_mechdog_selection_label(null);
    }

    const status = document.getElementById("mechdog-scan-status");
    const list = document.getElementById("mechdog-device-list");
    if (status) {
      status.className = "ui small message";
      status.textContent = "Scan to see nearby MechDogs.";
    }
    if (list) {
      list.innerHTML = "";
    }

    if (window.$) {
      window.$("#mechdog-modal").modal("show");
    }

    await this.scan_mechdogs();
  }

  async scan_mechdogs() {
    if (this.isMechDogScanning) {
      return;
    }

    const status = document.getElementById("mechdog-scan-status");
    const scanButton = document.getElementById("mechdog-scan");
    this.isMechDogScanning = true;

    if (status) {
      status.className = "ui small info message";
      status.textContent = "Scanning for nearby MechDogs...";
    }
    if (scanButton) {
      scanButton.classList.add("loading");
      scanButton.disabled = true;
    }

    try {
      const devices = await window.electronAPI.scanMechDogs();
      this.render_mechdog_devices(devices);
    } catch (error) {
      if (status) {
        status.className = "ui small negative message";
        status.textContent = `Scan failed: ${error.message}`;
      }
    } finally {
      this.isMechDogScanning = false;
      if (scanButton) {
        scanButton.classList.remove("loading");
        scanButton.disabled = false;
      }
    }
  }

  async select_mechdog(device) {
    const status = document.getElementById("mechdog-scan-status");
    try {
      if (status) {
        status.className = "ui small info message";
        status.textContent = `Selecting ${device.name || "MechDog"}...`;
      }

      await window.electronAPI.selectMechDog(device);
      this.update_mechdog_selection_label(device);

      if (status) {
        status.className = "ui small positive message";
        status.textContent = `Selected ${device.name || "MechDog"} (${device.address}).`;
      }

      if (window.neuroConsole) {
        window.neuroConsole.print(`Selected MechDog ${device.name || device.address}`, "success");
      }
    } catch (error) {
      if (status) {
        status.className = "ui small negative message";
        status.textContent = `Selection failed: ${error.message}`;
      }
      if (window.neuroConsole) {
        window.neuroConsole.print(`MechDog selection failed: ${error.message}`, "error");
      }
    }
  }

  /* Blockly Events */
  execute_code() {
    this.blockly.runCode();
  }

  download_code() {
    this.blockly.download();
  }

  /* Drone events */

  takeoff_drone() {
    console.log("take off");
    window.electronAPI.manualControl("takeoff");
  }

  drone_up() {
    window.electronAPI.manualControl("up");
  }

  drone_down() {
    window.electronAPI.manualControl("down");
  }

  drone_land() {
    console.log("land");
    window.electronAPI.manualControl("land");
  }

  /* Robot Events */
  async reconnect_vex() {
    console.log("Reconnecting to MechDog...");

    // Change button to show loading state
    const button = document.getElementById("vex-reconnect");
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="spinner loading icon"></i>';
    button.disabled = true;

    // Log to console
    if (window.neuroConsole) {
      window.neuroConsole.print("Attempting to reconnect to MechDog...", 'info');
    }

    try {
      const result = await window.electronAPI.vexReconnect();

      if (result.success) {
        if (window.neuroConsole) {
          window.neuroConsole.print(result.message || "Robot connected", 'success');
        }
        console.log("Robot reconnection successful");
      } else {
        if (window.neuroConsole) {
          window.neuroConsole.print(`Reconnection failed: ${result.message}`, 'error');
        }
        console.error("MechDog reconnection failed:", result.message);
      }
    } catch (error) {
      const errorMsg = `Error during MechDog reconnection: ${error.message}`;
      if (window.neuroConsole) {
        window.neuroConsole.print(errorMsg, 'error');
      }
      console.error(errorMsg);
    } finally {
      // Restore button state
      button.innerHTML = originalHTML;
      button.disabled = false;
    }
  }

  export_text_code() {
    // Import the coding mode manager
    import('./coding-mode-manager.js').then(({ codingModeManager }) => {
      if (codingModeManager && codingModeManager.isInitialized) {
        codingModeManager.exportCode('py');
      } else {
        console.warn('Coding mode manager not initialized. Using fallback export.');
        // Fallback: export Blockly-generated JavaScript
        const code = this.blockly.getLatestCode();
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'neuroscope_blocks.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  }
};
