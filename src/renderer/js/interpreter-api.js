import { WrapperFunctions } from "./wrapper-functions";

export const InterpreterAPI = class {
  constructor(workspace) {
    this.wrapperFunctions = new WrapperFunctions(workspace);
    this.nativeFunctions = {
      highlightBlock: this.wrapperFunctions.highlightWrapper,
      prompt: this.wrapperFunctions.promptWrapper,
      getDelta: this.wrapperFunctions.getDelta,
      getTheta: this.wrapperFunctions.getTheta,
      getAlpha: this.wrapperFunctions.getAlpha,
      getBeta: this.wrapperFunctions.getBeta,
      getGamma: this.wrapperFunctions.getGamma,
      blockly_print: this.wrapperFunctions.blockly_print
    };
    this.asyncFunctions = {
      filterSignal: this.wrapperFunctions.filterSignalWrapper,
      wait_seconds: this.wrapperFunctions.wait_seconds
    };
  }

  init(interpreter, globalObject) {
    for (let [key, value] of Object.entries(this.nativeFunctions)) {
      interpreter.setProperty(
        globalObject,
        key,
        interpreter.createNativeFunction(value.bind(this.wrapperFunctions))
      );
    }

    for (let [key, value] of Object.entries(this.asyncFunctions)) {
      interpreter.setProperty(
        globalObject,
        key,
        interpreter.createAsyncFunction(value.bind(this.wrapperFunctions))
      );
    }
  }
};
