//import { blocklyHooks } from "./blockly-hooks";
import { filterSignal } from "./utils";

export const WrapperFunctions = class {
  constructor(workspace) {
    this.workspace = workspace;
  }

  async filterSignalWrapper(list, callback) {
    try {
      let arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 3, 4, 5, 6, 7, 2, 2, 4, 5];
      callback(arr);
    } catch (error) {
      return error;
    }
  }

  async wait_seconds(timeInSeconds, callback) {
    setTimeout(callback, timeInSeconds * 1000);
  }

  highlightWrapper(id) {
    id = String(id || "");
    return this.workspace.highlightBlock(id);
  }

  blockly_print(text) {
    // Use the console if available, otherwise fall back to browser console
    if (window.neuroConsole) {
      window.neuroConsole.print(text, 'output');
    } else {
      console.log(text);
    }
  }

  getDelta() {
    const v = window?.band_powers?.delta;
    return Number.isFinite(v) ? v : 0;
  }

  getTheta() {
    const v = window?.band_powers?.theta;
    return Number.isFinite(v) ? v : 0;
  }

  getAlpha() {
    const v = window?.band_powers?.alpha;
    return Number.isFinite(v) ? v : 0;
  }

  getBeta() {
    const v = window?.band_powers?.beta;
    return Number.isFinite(v) ? v : 0;
  }

  getGamma() {
    const v = window?.band_powers?.gamma;
    return Number.isFinite(v) ? v : 0;
  }

  getMechdogBattery() {
    const v = window?.mechdogTelemetry?.battery;
    return Number.isFinite(v) ? v : 0;
  }

  getMechdogSonarDistance() {
    const v = window?.mechdogTelemetry?.sonarDistanceMm;
    return Number.isFinite(v) ? v : 0;
  }

  drone_up(value) {
    console.log("drone up");
    window.electronAPI.droneUp(value);
  }

  drone_down(value) {
    console.log("drone down");
    window.electronAPI.droneDown(value);
  }

  drone_forward(value) {
    console.log("drone forward");
    window.electronAPI.droneForward(value);
  }

  drone_back(value) {
    console.log("drone back");
    window.electronAPI.droneBack(value);
  }

  mechdog_back(distance) {
    window.electronAPI.sendCommand({ action: "move", distance, heading: 180 });
  }

  mechdog_forward(distance) {
    window.electronAPI.sendCommand({ action: "move", distance, heading: 0 });
  }

  mechdog_left(distance) {
    window.electronAPI.sendCommand({ action: "move", distance, heading: 270 });
  }

  mechdog_right(distance) {
    window.electronAPI.sendCommand({ action: "move", distance, heading: 90 });
  }

  mechdog_turn_left(degrees) {
    window.electronAPI.sendCommand({ action: "turn_left", degrees });
  }

  mechdog_turn_right(degrees) {
    window.electronAPI.sendCommand({ action: "turn_right", degrees });
  }

  mechdog_handshake() {
    window.electronAPI.sendCommand({ action: "mechdog_action", type: "handshake" });
  }

  mechdog_boxing() {
    window.electronAPI.sendCommand({ action: "mechdog_action", type: "boxing" });
  }

  ccw(value) {
    console.log("ccw");
    window.electronAPI.ccw(value);
  }

  cw(value) {
    console.log("cw");
    window.electronAPI.cw(value);
  }

  takeoff() {
    window.electronAPI.manualControl("takeoff");
  }

  land() {
    window.electronAPI.manualControl("land");
  }
};
