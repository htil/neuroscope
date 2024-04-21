// Block creation tool https://blockly-demo.appspot.com/static/demos/blockfactory/index.html
import * as Blockly from "blockly/core";
import { javascriptGenerator, Order } from "blockly/javascript";

export const createCustomBlocks = function () {
  /* Get Filter */
  var filterData = {
    type: "filter_signal",
    message0: "filter between %1 and  %2 %3",
    args0: [
      {
        type: "field_input",
        name: "low",
        text: "0"
      },
      {
        type: "field_input",
        name: "high",
        text: "30"
      },
      {
        type: "input_value",
        name: "signal"
      }
    ],
    output: null,
    colour: 230,
    tooltip: "",
    helpUrl: ""
  };

  Blockly.Blocks["filter_signal"] = {
    init: function () {
      this.jsonInit(filterData);
    }
  };

  javascriptGenerator.forBlock["filter_signal"] = function (block, generator) {
    var text_low = block.getFieldValue("low");
    var text_high = block.getFieldValue("high");
    var value_signal = generator.valueToCode(block, "signal", Order.ATOMIC);
    var code = `filterSignal(${value_signal}, ${text_low}, ${text_high})`;
    return [code, Order.None];
  };

  /*
  Blockly.JavaScript["filter_signal"] = function (block) {
    var text_low = block.getFieldValue("low");
    var text_high = block.getFieldValue("high");
    var value_signal = Blockly.JavaScript.valueToCode(
      block,
      "signal",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    //console.log(text_low, text_high, value_signal)
    // TODO: Assemble JavaScript into code variable.
    var code = `filterSignal(${value_signal}, ${text_low}, ${text_high})`;
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };
  */
};
