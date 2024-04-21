//import { blocklyHooks } from "./blockly-hooks";
import { filterSignal } from "./utils";

export const WrapperFunctions = class {
  constructor(workspace) {
    this.workspace = workspace;
  }

  async filterSignalWrapper(list, callback) {
    try {
      let arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 3, 4, 5, 6, 7, 2, 2, 4, 5];
      //let filteredData = await blocklyHooks.filterSignalHook(arr, low, high);
      //let filteredData = await filterSignal(arr, low, high);
      callback(arr);
    } catch (error) {
      return error;
    }
  }

  highlightWrapper(id) {
    console.log("highlighting block");
    id = String(id || "");
    return this.workspace.highlightBlock(id);
  }

  promptWrapper(text) {
    return window.prompt(text);
  }
};
