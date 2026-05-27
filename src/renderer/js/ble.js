import { MuseElectronClient } from "./muse-client.js";
import { GanglionClient } from "./ganglion-client.js";

export const BLE = class {
  constructor(callback, connect_button_id = "bluetooth", sessionConfig = null) {
    this.device = null;
    this.callback = callback;
    this.sessionConfig = sessionConfig;

    // Connect Events
    document.getElementById(connect_button_id).onclick = function (e) {
      //console.log("clicked");
      $(".ui.modal").modal("show");
      this.connect();
    }.bind(this);

    window.electronAPI.getBLEList((event, list) => {
      let ble_device_list = [];
      for (let device in list) {
        //console.log(list[device].deviceName);
        //let obj = { name: list[device].deviceName, id: list[device].deviceId };
        ble_device_list.push(list[device]);
      }
      this.build_ble_modal_list(this.filter_device_list(ble_device_list));
      //console.log(event, list);
    });

    // Capture input for muse device selection
    const wrapper = document.getElementById("ble_list");
    wrapper.addEventListener("click", (event) => {
      const isButton = event.target.nodeName === "BUTTON";
      if (!isButton) {
        return;
      }
      let ble_device = event.target.getAttribute("data");
      window.electronAPI.selectBluetoothDevice(ble_device);
      $(".ui.modal").modal("hide");
      //console.log();
    });
  }

  filter_device_list(device_list) {
    const inputDevice = this.sessionConfig?.getInputDevice?.();
    const prefixes = inputDevice?.bluetoothPrefixes || [];

    if (prefixes.length === 0) {
      return [];
    }

    return device_list.filter((device) => {
      const deviceName = device.deviceName || "";
      return prefixes.some((prefix) => deviceName.startsWith(prefix));
    });
  }

  generate_ble_list_option(device_name, device_id) {
    return `<div class="item" style="display: flex; justify-content: center">
    <div
      style="
        flex-direction: row;
        display: flex;
        justify-content: space-between;
        width: 400px;
      "
    >
      <h1>${device_name}</h1>
      <div>
        <button data="${device_id}" class="ui primary button">Connect</button>
      </div>
    </div>
  </div>`;
  }

  build_ble_modal_list(device_list) {
    document.getElementById("ble_list").innerHTML = "";

    if (device_list.length === 0) {
      const inputDevice = this.sessionConfig?.getInputDevice?.();
      document.getElementById("ble_list").innerHTML = `
        <div class="ui message">
          <div class="header">No matching devices found</div>
          <p>Looking for ${inputDevice?.label || "the selected input device"}.</p>
        </div>
      `;
      return;
    }

    for (let device in device_list) {
      let _device = device_list[device];
      const node = document.createElement("div");
      node.innerHTML = this.generate_ble_list_option(_device.deviceName, _device.deviceId);
      document.getElementById("ble_list").appendChild(node);
    }
  }

  async connect() {
    const inputDevice = this.sessionConfig?.getInputDevice?.();

    if (inputDevice?.id === "keyboard") {
      window.neuroConsole?.print("Keyboard input does not need Bluetooth.", "info");
      return;
    }

    this.device?.disconnect?.();
    this.device = inputDevice?.id === "ganglion" ? new GanglionClient() : new MuseElectronClient();

    await this.device.connect();

    if (inputDevice?.id === "ganglion") {
      this.device.readings.subscribe(this.callback);
      window.neuroConsole?.print("Ganglion EMG stream connected.", "success");
      return;
    }

    this.device.eegReadings.subscribe(this.callback);
  }

  get_device() {
    return this.device;
  }
};
