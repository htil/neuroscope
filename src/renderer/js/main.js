/*

import { Events } from "./events.js"
import { FeatureExtractor } from "./feature-extractor.js"
import {BandPowerPlot} from "./band-power-plot.js"
import {BandPowerLineGraph} from "./bp-line-graph.js"
*/

import { MuseGraph } from "./muse-graph.js";
import { BLE } from "./ble.js";
import { Events } from "./events.js";
import { Signal } from "./signal.js";
import { FeatureExtractor } from "./feature-extractor.js";
import { ChannelVis } from "./channel_vis.js";
import { BlocklyMain } from "./blockly-main.js";
import { Console } from "./console.js";

let ws;
let wsReconnectAttempts = 0;
const maxReconnectAttempts = 5;

// function connectWebSocket() {
//   ws = new WebSocket("ws://127.0.0.1:8777");

//   ws.onopen = () => {
//     console.log("WebSocket connection established");
//     wsReconnectAttempts = 0;
//   };

//   ws.onerror = (error) => {
//     console.log("WebSocket connection attempt failed, retrying...");
//   };

//   ws.onclose = () => {
//     if (wsReconnectAttempts < maxReconnectAttempts) {
//       wsReconnectAttempts++;
//       console.log(`WebSocket reconnecting... attempt ${wsReconnectAttempts}`);
//       setTimeout(connectWebSocket, 2000); // Wait 2 seconds before retry
//     }
//   };

//   ws.onmessage = (event) => {
//     console.log("Message from server:", event.data);
//   };
// }

// Wait a bit before connecting to give Python server time to start
// setTimeout(connectWebSocket, 3000);

function sendCommand(command) {
  window.electronAPI.sendCommand(command);
}

window.sendCommand = sendCommand;

export const NeuroScope = class {
  constructor() {
    this.blocklyMain = new BlocklyMain();
    this.signal_handler = new Signal(512, "ganglion");
    this.console = new Console();
    this.events = new Events(this.blocklyMain);
    //this.ble = new BLE(this.signal_handler.add_data.bind(this.signal_handler));
    this.ble = new BLE(this.signal_handler.add_data_ganglion.bind(this.signal_handler));

    this.feature_extractor = new FeatureExtractor(256);
    this.blocklyMain.start();

    // Make console available globally for Blockly print commands
    window.neuroConsole = this.console;

    setTimeout(() => {
      //this.ble.build_ble_modal_list(["device1", "device2"]);
      this.console.log("NeuroScope initialized successfully");
    }, 3000);

    setInterval(() => {
      this.signal_handler.plot_data(0);
      this.signal_handler.plot_data(1);
      this.signal_handler.plot_data(2);
      this.signal_handler.plot_data(3);
      let data = this.signal_handler.get_data();
      let band_powers = this.feature_extractor.getFormattedBandPowers(data);
      window.band_powers = band_powers;

      // Instead of updating band power visualization, we could log signal data
      // Uncomment the line below if you want to see signal updates in console
      // this.console.log(`Signal channels: ${data.map(ch => ch.length).join(', ')} samples`);
    }, 400);
  }
};

let neuroScope = new NeuroScope();
