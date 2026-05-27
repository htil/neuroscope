import * as Blockly from "blockly/core";
import locale from "blockly/msg/en";
import * as libraryBlocks from "blockly/blocks";
import { javascriptGenerator, Order } from "blockly/javascript";
import { createCustomBlocks } from "./customblock.js";
import { Categories } from "./categories.js";
import { Toolbox, unwind } from "./Toolbox.js";
import Interpreter from "js-interpreter";
import { InterpreterAPI } from "./interpreter-api.js";

Blockly.setLocale(locale);
let { cat_logic, cat_loops, cat_math, cat_sep, cat_data, cat_mechdog } = Categories;

export const BlocklyMain = class {
  constructor() {
    createCustomBlocks();
    this.interpreter = null;
    this.runner = null;
    this.latestCode = "";
    this.validationSensorTypes = new Set(["muscle_energy", "delta", "theta", "alpha", "beta", "gamma"]);
    this.booleanConditionTypes = new Set(["logic_compare", "logic_operation", "logic_negate", "logic_boolean"]);

    // let cat_robot = {
    //   name: "Robot Controls",
    //   colour: 160,
    //   modules: ["move", "led_control"]
    // };

    let _toolbox = new Toolbox(this.getToolboxCategories("mechdog"));

    this.workspace = Blockly.inject("blocklyDiv", {
      toolbox: _toolbox.toString(),
    });

    this.registerCustomToolbox();
  }

  getToolboxCategories = () => {
    const robotCategory = cat_mechdog;

    return [
      cat_logic,
      cat_loops,
      cat_math,
      cat_sep,
      cat_data,
      ...(robotCategory ? [robotCategory] : [])
    ];
  };

  setOutputTarget = () => {
    const toolbox = new Toolbox(this.getToolboxCategories());
    this.workspace.updateToolbox(toolbox.toString());
  };

  createCustomToolBox = (blocks) => {
    let res = [];
    blocks.forEach((element) => {
      let block = unwind([element], true);
      block = Blockly.utils.xml.textToDom(block).firstChild;
      res.push(block);
    });
    return res;
  };

  download() {
    //let filename = prompt();
    let filename = "test";
    filename = `${filename}.xml`;

    let as_dom = Blockly.Xml.workspaceToDom(this.workspace);
    let as_text = Blockly.Xml.domToText(as_dom);

    var element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(as_text));
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  resetInterpreter = () => {
    this.interpreter = null;
    this.workspace.highlightBlock(null);
    if (this.runner) {
      clearTimeout(this.runner);
      this.runner = null;
    }
  };

  clearValidationWarnings = () => {
    this.workspace.getAllBlocks(false).forEach((block) => {
      block.setWarningText(null);
    });
  };

  getBlockLabel = (block) => {
    if (!block) return "this block";

    const blockLabels = {
      muscle_energy: "muscle energy",
      delta: "delta",
      theta: "theta",
      alpha: "alpha",
      beta: "beta",
      gamma: "gamma",
      print: "print",
      filter_signal: "filter signal",
      drone_up: "right",
      drone_down: "left",
      drone_forward: "forward",
      drone_back: "back",
      ccw: "rotate counter-clockwise",
      cw: "rotate clockwise",
      mechdog_forward: "forward",
      mechdog_back: "back",
      mechdog_left: "left",
      mechdog_right: "right",
      mechdog_handshake: "handshake",
      mechdog_boxing: "boxing",
      controls_if: "if"
    };

    return blockLabels[block.type] || block.type.replaceAll("_", " ");
  };

  addValidationError = (errors, block, message) => {
    if (!block) return;

    const existingMessage = block.getWarningText();
    block.setWarningText(existingMessage ? `${existingMessage}\n${message}` : message);
    errors.push({ block, message });
  };

  addPriorityValidationError = (errors, block, message) => {
    if (!block) return;

    const existingMessage = block.getWarningText();
    block.setWarningText(existingMessage ? `${existingMessage}\n${message}` : message);
    errors.unshift({ block, message });
  };

  validateRequiredInput = (errors, block, inputName, message) => {
    if (!block.getInputTargetBlock(inputName)) {
      this.addValidationError(errors, block, message);
    }
  };

  isBooleanConditionBlock = (block) => {
    if (!block) return false;
    return this.booleanConditionTypes.has(block.type);
  };

  validateOpenInputs = (errors, block) => {
    block.inputList.forEach((input) => {
      if (!input.connection || input.connection.targetBlock()) {
        return;
      }

      if (block.type === "controls_if" && input.name.startsWith("IF")) {
        this.addPriorityValidationError(
          errors,
          block,
          'This if block needs a true-or-false test. Try using an operator block like ">", "<", or "=".'
        );
        return;
      }

      const inputLabel = input.fieldRow
        .map((field) => (typeof field.getText === "function" ? field.getText() : ""))
        .join(" ")
        .trim();

      const blockLabel = this.getBlockLabel(block);
      this.addValidationError(
        errors,
        block,
        inputLabel
          ? `Finish the "${inputLabel}" part of the ${blockLabel} block.`
          : `Finish the ${blockLabel} block before running.`
      );
    });
  };

  validateLooseValueBlock = (errors, block) => {
    const isTopLevel = !block.getParent();
    const isValueOnlyBlock = Boolean(block.outputConnection) && !block.previousConnection && !block.nextConnection;

    if (!isTopLevel || !isValueOnlyBlock) {
      return;
    }

    const label = this.getBlockLabel(block);
    this.addValidationError(
      errors,
      block,
      `${label.charAt(0).toUpperCase() + label.slice(1)} needs to be connected to another block to do anything.`
    );
  };

  validateWorkspace = () => {
    try {
      this.clearValidationWarnings();

      const errors = [];
      const allBlocks = this.workspace.getAllBlocks(false);

      if (allBlocks.length === 0) {
        return {
          isValid: false,
          errors: [{ block: null, message: "Add some blocks before you press Run." }]
        };
      }

      allBlocks.forEach((block) => {
        switch (block.type) {
          case "controls_if": {
            const conditionBlock = block.getInputTargetBlock("IF0");

            if (!conditionBlock) {
              this.addPriorityValidationError(
                errors,
                block,
                'This if block needs a true-or-false test. Try using an operator block like ">", "<", or "=".'
              );
              break;
            }

            if (this.validationSensorTypes.has(conditionBlock.type)) {
              const sensorLabel = this.getBlockLabel(conditionBlock);
              this.addPriorityValidationError(
                errors,
                block,
                `Try using an operator block to compare ${sensorLabel} to a number, like "${sensorLabel} > 15".`
              );
              break;
            }

            if (!this.isBooleanConditionBlock(conditionBlock)) {
              this.addPriorityValidationError(
                errors,
                block,
                'This if block needs a true-or-false test. Try using an operator block like ">", "<", or "=".'
              );
            }
            break;
          }
          case "logic_compare":
            this.validateRequiredInput(errors, block, "A", "Finish the left side of this comparison.");
            this.validateRequiredInput(errors, block, "B", "Finish the right side of this comparison with a number or value.");
            break;
          case "print":
            this.validateRequiredInput(errors, block, "val", "Choose something to print first.");
            break;
          case "filter_signal":
            this.validateRequiredInput(errors, block, "signal", "Pick a signal to filter before running.");
            break;
          case "drone_up":
          case "drone_down":
          case "drone_forward":
          case "drone_back":
          case "ccw":
          case "cw":
            this.validateRequiredInput(
              errors,
              block,
              "value",
              `Add a number to tell ${this.getBlockLabel(block)} how far to move.`
            );
            break;
          case "mechdog_forward":
          case "mechdog_back":
          case "mechdog_left":
          case "mechdog_right":
            this.validateRequiredInput(
              errors,
              block,
              "distance",
              `Add a number of inches for ${this.getBlockLabel(block)}.`
            );
            break;
        }

        this.validateOpenInputs(errors, block);
        this.validateLooseValueBlock(errors, block);
      });

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      this.reportExecutionError(error, "There is a problem checking these blocks.");
      return {
        isValid: false,
        errors: [{ block: null, message: "There is a problem checking these blocks." }]
      };
    }
  };

  showValidationErrors = (validationResult) => {
    const firstError = validationResult.errors[0];
    const summary = firstError?.message || "Please fix the highlighted block before running.";

    if (firstError?.block) {
      firstError.block.select();
    }

    const extraProblems = validationResult.errors.length - 1;
    const extraText =
      extraProblems > 0
        ? ` ${extraProblems === 1 ? "There is 1 more problem to fix." : `There are ${extraProblems} more problems to fix.`}`
        : "";

    this.showValidationBanner(`Cannot run yet: ${summary}${extraText}`);

    if (window.neuroConsole) {
      window.neuroConsole.print(`Cannot run yet: ${summary}`, "error");
      if (extraProblems > 0) {
        window.neuroConsole.print(
          extraProblems === 1 ? "There is 1 more problem to fix." : `There are ${extraProblems} more problems to fix.`,
          "warning"
        );
      }
    }
  };

  showValidationBanner = (message) => {
    const existingBanner = document.getElementById("blockly-validation-banner");
    if (existingBanner) {
      existingBanner.remove();
    }

    const banner = document.createElement("div");
    banner.id = "blockly-validation-banner";
    banner.style.position = "fixed";
    banner.style.top = "16px";
    banner.style.left = "50%";
    banner.style.transform = "translateX(-50%)";
    banner.style.zIndex = "2000";
    banner.style.maxWidth = "520px";
    banner.style.padding = "12px 16px";
    banner.style.borderRadius = "10px";
    banner.style.backgroundColor = "#fff4f4";
    banner.style.color = "#9f3a38";
    banner.style.border = "1px solid #e0b4b4";
    banner.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.12)";
    banner.style.fontFamily = "sans-serif";
    banner.style.fontSize = "14px";
    banner.style.lineHeight = "1.4";
    banner.style.cursor = "pointer";
    banner.textContent = message;
    banner.title = "Click to dismiss";

    banner.addEventListener("click", () => {
      banner.remove();
    });

    document.body.appendChild(banner);

    window.setTimeout(() => {
      if (banner.parentNode) {
        banner.remove();
      }
    }, 7000);
  };

  normalizeErrorMessage = (error) => {
    if (!error) {
      return "Something went wrong while running the blocks.";
    }

    if (typeof error === "string") {
      return error;
    }

    if (error.message) {
      return error.message;
    }

    return String(error);
  };

  reportExecutionError = (error, fallbackMessage = "Something went wrong while running the blocks.") => {
    const message = this.normalizeErrorMessage(error) || fallbackMessage;
    this.showValidationBanner(`Cannot run yet: ${message}`);

    if (window.neuroConsole) {
      window.neuroConsole.print(`Cannot run yet: ${message}`, "error");
    } else {
      console.error(message);
    }
  };

  executeCode = () => {
    console.log("latest Code: ", this.latestCode);
    this.workspace.highlightBlock(null);

    try {
      let interpreterApi = new InterpreterAPI(this.workspace);

      // For text-based code example see previous projects such as our work published at HRI
      this.interpreter = new Interpreter(this.latestCode, interpreterApi.init.bind(interpreterApi));

      this.runner = function () {
        // If no interpreter do not run
        if (!this.interpreter) return;

        try {
          var hasMore = this.interpreter.step();

          // If the interpreter is still running keep going
          if (hasMore) {
            setTimeout(this.runner.bind(this), 1);
          } else {
            this.resetInterpreter();
          }
        } catch (error) {
          this.resetInterpreter();
          this.reportExecutionError(error);
        }
      };

      this.runner();
    } catch (error) {
      this.resetInterpreter();
      this.reportExecutionError(error);
      return false;
    }

    return true;
  };

  generateLatestCode = () => {
    try {
      javascriptGenerator.STATEMENT_PREFIX = "highlightBlock(%1);\n";
      javascriptGenerator.addReservedWords("highlightBlock");
      this.setLatestCode(javascriptGenerator.workspaceToCode(this.workspace));
      return true;
    } catch (error) {
      this.setLatestCode("");
      this.reportExecutionError(error, "There is a problem with these blocks.");
      return false;
    }
  };

  runCode = () => {
    const validationResult = this.validateWorkspace();
    if (!validationResult.isValid) {
      this.showValidationErrors(validationResult);
      return false;
    }

    if (!this.generateLatestCode()) {
      return false;
    }

    if (this.interpreter == null) {
      return this.executeCode();
    }

    return false;
  };

  registerCustomToolbox = () => {
    // Triggers everytime category opens
    this.workspace.registerToolboxCategoryCallback("DATA", (ws) => {
      return this.createCustomToolBox([
        "filter_signal",
        "muscle_energy",
      ]);
    });
  };

  setLatestCode = (code) => {
    this.latestCode = code;
  };

  stop = () => {
    this.resetInterpreter();
  };

  start = () => {
    this.generateLatestCode();

    let eventListener = (event) => {
      if (event.type !== Blockly.Events.Ui) {
        this.resetInterpreter();
        this.clearValidationWarnings();
        try {
          this.generateLatestCode();
        } catch (error) {
          this.setLatestCode("");
        }
      }
    };

    this.workspace.addChangeListener(eventListener);
  };
};
