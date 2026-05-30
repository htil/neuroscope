import { WrapperFunctions } from "./wrapper-functions";

export const InterpreterAPI = class {
  constructor(workspace) {
    this.wrapperFunctions = new WrapperFunctions(workspace);

    // Expose all the functions you need inside Blockly’s interpreter
    this.nativeFunctions = {
      highlightBlock: this.wrapperFunctions.highlightWrapper,
      getDelta: this.wrapperFunctions.getDelta,
      getTheta: this.wrapperFunctions.getTheta,
      getAlpha: this.wrapperFunctions.getAlpha,
      getBeta: this.wrapperFunctions.getBeta,
      getGamma: this.wrapperFunctions.getGamma,
      getMechdogBattery: this.wrapperFunctions.getMechdogBattery,
      getMechdogSonarDistance: this.wrapperFunctions.getMechdogSonarDistance,
      blockly_print: this.wrapperFunctions.blockly_print,
      drone_up: this.wrapperFunctions.drone_up,
      drone_down: this.wrapperFunctions.drone_down,
      drone_forward: this.wrapperFunctions.drone_forward,
      drone_back: this.wrapperFunctions.drone_back,
      ccw: this.wrapperFunctions.ccw,
      cw: this.wrapperFunctions.cw,
      takeoff: this.wrapperFunctions.takeoff,
      land: this.wrapperFunctions.land,
      // VEX commands
      vex_turn_left: this.wrapperFunctions.vex_turn_left,
      vex_turn_right: this.wrapperFunctions.vex_turn_right,
      vex_forward: this.wrapperFunctions.vex_forward,
      vex_back: this.wrapperFunctions.vex_back,
      vex_left: this.wrapperFunctions.vex_left,
      vex_right: this.wrapperFunctions.vex_right,
      mechdog_back: this.wrapperFunctions.mechdog_back,
      mechdog_stop: this.wrapperFunctions.mechdog_stop,
      mechdog_handshake: this.wrapperFunctions.mechdog_handshake,
      mechdog_boxing: this.wrapperFunctions.mechdog_boxing,
      // Kicker
      vex_kicker: this.wrapperFunctions.vex_kicker,

      // ← NEW: expose muscle energy from window.filteredSample
      getMuscleEnergy: () => window.filteredSample
    };

    this.asyncFunctions = {
      filterSignal: this.wrapperFunctions.filterSignalWrapper,
      wait_seconds: this.wrapperFunctions.wait_seconds
    };
  }

  init(interpreter, globalObject) {
    // Bind native (synchronous) functions
    for (const [name, fn] of Object.entries(this.nativeFunctions)) {
      interpreter.setProperty(
        globalObject,
        name,
        interpreter.createNativeFunction(fn.bind(this.wrapperFunctions))
      );
    }

    // Bind async functions (returning promises)
    for (const [name, fn] of Object.entries(this.asyncFunctions)) {
      interpreter.setProperty(
        globalObject,
        name,
        interpreter.createAsyncFunction(fn.bind(this.wrapperFunctions))
      );
    }
  }
};
