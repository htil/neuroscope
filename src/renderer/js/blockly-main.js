import * as Blockly from "blockly/core";
import { Categories } from "./categories.js";
let { cat_logic, cat_loops, cat_math, cat_sep, cat_data, cat_vars, cat_list } = Categories;
import { Toolbox, unwind } from "./Toolbox.js";

export const BlocklyMain = class {
  constructor() {
    let _toolbox = new Toolbox([
      cat_logic,
      cat_loops,
      cat_math,
      cat_sep,
      cat_data,
      cat_vars,
      cat_list
    ]);

    window.workspace = Blockly.inject("blocklyDiv", {
      toolbox: _toolbox.toString()
      //toolbox: document.getElementById("toolbox"),
    });
  }
};
