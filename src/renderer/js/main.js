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
import { BandPowerVis } from "./band-power-vis.js";
import { simpleTextView } from "./simple-text-view.js";
import { Console } from "./console.js";
import { SessionConfig } from "./session-config.js";
import { SessionUI, renderSessionOptions } from "./session-ui.js";

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
    this.sessionConfig = new SessionConfig();
    renderSessionOptions();
    this.sessionUI = new SessionUI(this.sessionConfig);
    this.sessionUI.initialize();

    this.blocklyMain = new BlocklyMain();
    this.signal_handler = new Signal(512);
    this.bpBis = null;
    this.events = new Events(this.blocklyMain);
    this.ble = new BLE(this.addDeviceData.bind(this), "bluetooth", this.sessionConfig);
    this.feature_extractor = new FeatureExtractor(256);
    this.blocklyMain.start();
    simpleTextView.initialize(this.blocklyMain);

    this.sessionConfig.onChange((session, inputDevice, outputTarget) => {
      this.applySession(inputDevice, outputTarget);
    });

    // Ensure a defined, numeric global for wrapper functions
    window.band_powers = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };

    const sanitize = (bp) => ({
      delta: Number.isFinite(Number(bp?.delta)) ? Number(bp.delta) : 0,
      theta: Number.isFinite(Number(bp?.theta)) ? Number(bp.theta) : 0,
      alpha: Number.isFinite(Number(bp?.alpha)) ? Number(bp.alpha) : 0,
      beta: Number.isFinite(Number(bp?.beta)) ? Number(bp.beta) : 0,
      gamma: Number.isFinite(Number(bp?.gamma)) ? Number(bp.gamma) : 0,
    });

    setInterval(() => {
      const inputDevice = this.sessionConfig.getInputDevice();

      // Plot EEG channels
      this.signal_handler.plot_data(0);
      this.signal_handler.plot_data(1);
      this.signal_handler.plot_data(2);
      this.signal_handler.plot_data(3);

      if (inputDevice.panel !== "bands" || !this.bpBis) {
        return;
      }

      // Compute and render band power
      const data = this.signal_handler.get_data();
      const band_powers = this.feature_extractor.getFormattedBandPowers(data);

      // Update chart and global values used by Blockly getters
      window.band_powers = sanitize(band_powers);
      this.bpBis.update(window.band_powers);
    }, 400);
  }

  applySession(inputDevice, outputTarget) {
    const title = document.getElementById("signal-panel-title");
    if (title) {
      title.textContent = inputDevice.panel === "bands" ? "Frequency Bands" : "Console";
    }

    if (inputDevice.panel === "bands") {
      window.neuroConsole = null;
      this.bpBis = new BandPowerVis();
    } else {
      this.bpBis = null;
      window.neuroConsole = new Console();
      window.neuroConsole.print(`${inputDevice.label} session ready`, "success");
    }

    document.body.dataset.inputDevice = inputDevice.id;
    document.body.dataset.outputTarget = outputTarget.id;
  }

  addDeviceData(sample) {
    const inputDevice = this.sessionConfig.getInputDevice();

    if (inputDevice.id === "ganglion") {
      this.signal_handler.add_data_ganglion(sample);
      return;
    }

    this.signal_handler.add_data(sample);
  }
};

let neuroScope = new NeuroScope();
