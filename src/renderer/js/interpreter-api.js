import { WrapperFunctions } from "./wrapper-functions";

export const InterpreterAPI = class {
  constructor(workspace) {
    this.wrapperFunctions = new WrapperFunctions(workspace);
    this.nativeFunctions = {
      highlightBlock: this.wrapperFunctions.highlightWrapper,
      prompt: this.wrapperFunctions.promptWrapper
    };
    this.asyncFunctions = {
      filterSignal: this.wrapperFunctions.filterSignalWrapper
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
