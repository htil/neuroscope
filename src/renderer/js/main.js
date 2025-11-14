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

    // Initialize simple text view after console is ready
    setTimeout(() => {
      try {
        simpleTextView.initialize(this.blocklyMain);
        console.log("Text view initialized successfully");
        this.console.info("NeuroScope with text view initialized successfully");
      } catch (error) {
        console.error('Failed to initialize text view:', error);
        this.console.error("Text view initialization failed: " + error.message);
      }
    }, 500); // Reduced from 3000 to 500ms

    // Listen for VEX status updates and update UI badge
    if (window.electronAPI && typeof window.electronAPI.onVexStatus === 'function') {
      window.electronAPI.onVexStatus((status) => {
        try {
          const dot = document.getElementById('vex-status-dot');
          if (!dot) return;
          const { wsConnected, robotConnected } = status || {};
          // Reset base classes
          dot.className = 'ui empty circular label';
          if (!wsConnected) {
            dot.classList.add('grey');
            dot.title = 'VEX status: app not connected to local server';
          } else if (!robotConnected) {
            dot.classList.add('yellow');
            dot.title = 'VEX status: server connected, robot not connected';
          } else {
            dot.classList.add('green');
            dot.title = 'VEX status: robot connected';
          }
        } catch (e) {
          console.warn('Failed to update VEX status dot:', e);
        }
      });
      // Request an initial status snapshot shortly after load
      setTimeout(() => {
        if (typeof window.electronAPI.requestVexStatus === 'function') {
          window.electronAPI.requestVexStatus();
        }
      }, 800);
    }

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
