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

function updateMechdogSonarReadout(sonarDistanceMm) {
  const sonarEl = document.getElementById("mechdog-sonar-readout");
  if (!sonarEl) return;

  const distance = Number(sonarDistanceMm);
  if (!Number.isFinite(distance) || distance <= 0) {
    sonarEl.textContent = "-- mm";
    sonarEl.style.color = "#767676";
    return;
  }

  sonarEl.textContent = `${distance} mm`;
  if (distance < 200) {
    sonarEl.style.color = "#db2828";
  } else if (distance < 500) {
    sonarEl.style.color = "#f2711c";
  } else {
    sonarEl.style.color = "#2185d0";
  }
}

export const NeuroScope = class {
  constructor() {
    this.blocklyMain = new BlocklyMain();
    this.signal_handler = new Signal(512);
    this.bpBis = new BandPowerVis();
    this.events = new Events(this.blocklyMain);
    this.ble = new BLE(this.signal_handler.add_data.bind(this.signal_handler));
    this.feature_extractor = new FeatureExtractor(256);
    this.blocklyMain.start();

    // Ensure a defined, numeric global for wrapper functions
    window.band_powers = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
    window.mechdogTelemetry = { battery: 0, sonarDistanceMm: 0 };

    window.electronAPI.onVexStatus((status) => {
      window.mechdogTelemetry = {
        battery: Number.isFinite(Number(status?.battery)) ? Number(status.battery) : window.mechdogTelemetry.battery,
        sonarDistanceMm: Number.isFinite(Number(status?.sonarDistanceMm))
          ? Number(status.sonarDistanceMm)
          : window.mechdogTelemetry.sonarDistanceMm,
      };
      updateMechdogSonarReadout(window.mechdogTelemetry.sonarDistanceMm);
    });
    window.electronAPI.requestVexStatus();
    updateMechdogSonarReadout(window.mechdogTelemetry.sonarDistanceMm);

    const sanitize = (bp) => ({
      delta: Number.isFinite(Number(bp?.delta)) ? Number(bp.delta) : 0,
      theta: Number.isFinite(Number(bp?.theta)) ? Number(bp.theta) : 0,
      alpha: Number.isFinite(Number(bp?.alpha)) ? Number(bp.alpha) : 0,
      beta: Number.isFinite(Number(bp?.beta)) ? Number(bp.beta) : 0,
      gamma: Number.isFinite(Number(bp?.gamma)) ? Number(bp.gamma) : 0,
    });

    setInterval(() => {
      // Plot EEG channels
      this.signal_handler.plot_data(0);
      this.signal_handler.plot_data(1);
      this.signal_handler.plot_data(2);
      this.signal_handler.plot_data(3);

      // Compute and render band power
      const data = this.signal_handler.get_data();
      const band_powers = this.feature_extractor.getFormattedBandPowers(data);

      // Update chart and global values used by Blockly getters
      window.band_powers = sanitize(band_powers);
      this.bpBis.update(window.band_powers);
    }, 400);
  }
};

let neuroScope = new NeuroScope();
