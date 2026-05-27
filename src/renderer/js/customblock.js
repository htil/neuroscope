// Block creation tool https://blockly-demo.appspot.com/static/demos/blockfactory/index.html
import * as Blockly from "blockly/core";
import { javascriptGenerator, Order } from "blockly/javascript";

let dr  // 1. Define the block's JSONks_color = 70;

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

  ///////// Delta

  var getDeltaPower = {
    type: "delta",
    message0: "delta",
    output: null,
    colour: 330,
    tooltip: "",
    helpUrl: ""
  };

  Blockly.Blocks["delta"] = {
    init: function () {
      this.jsonInit(getDeltaPower);
    }
  };

  javascriptGenerator.forBlock["delta"] = function (block, generator) {
    var code = "getDelta()";
    return [code, Order.FUNCTION_CALL];
  };

  ///////// Theta

  var getThetaPower = {
    type: "theta",
    message0: "theta",
    output: null,
    colour: 330,
    tooltip: "",
    helpUrl: ""
  };

  Blockly.Blocks["theta"] = {
    init: function () {
      this.jsonInit(getThetaPower);
    }
  };

  javascriptGenerator.forBlock["theta"] = function (block, generator) {
    var code = "getTheta()";
    return [code, Order.FUNCTION_CALL];
  };

  ///////// Alpha

  var getAlphaPower = {
    type: "alpha",
    message0: "alpha",
    output: null,
    colour: 330,
    tooltip: "",
    helpUrl: ""
  };

  Blockly.Blocks["alpha"] = {
    init: function () {
      this.jsonInit(getAlphaPower);
    }
  };

  javascriptGenerator.forBlock["alpha"] = function (block, generator) {
    var code = "getAlpha()";
    return [code, Order.FUNCTION_CALL];
  };

  ///////// Beta

  var getBetaPower = {
    type: "beta",
    message0: "beta",
    output: null,
    colour: 330,
    tooltip: "",
    helpUrl: ""
  };

  Blockly.Blocks["beta"] = {
    init: function () {
      this.jsonInit(getBetaPower);
    }
  };

  javascriptGenerator.forBlock["beta"] = function (block, generator) {
    var code = "getBeta()";
    return [code, Order.FUNCTION_CALL];
  };

  ///////// Gamma

  var getGammaPower = {
    type: "gamma",
    message0: "gamma",
    output: null,
    colour: 330,
    tooltip: "",
    helpUrl: ""
  };

  Blockly.Blocks["gamma"] = {
    init: function () {
      this.jsonInit(getGammaPower);
    }
  };

  javascriptGenerator.forBlock["gamma"] = function (block, generator) {
    var code = "getGamma()";
    return [code, Order.FUNCTION_CALL];
  };

  var getMechdogBattery = {
    type: "mechdog_battery",
    message0: "dog battery",
    output: "Number",
    colour: 70,
    tooltip: "Latest MechDog battery percentage",
    helpUrl: ""
  };

  Blockly.Blocks["mechdog_battery"] = {
    init: function () {
      this.jsonInit(getMechdogBattery);
    }
  };

  javascriptGenerator.forBlock["mechdog_battery"] = function () {
    return ["getMechdogBattery()", Order.FUNCTION_CALL];
  };

  var getMechdogSonar = {
    type: "mechdog_sonar",
    message0: "dog sonar mm",
    output: "Number",
    colour: 70,
    tooltip: "Latest MechDog sonar distance in millimeters",
    helpUrl: ""
  };

  Blockly.Blocks["mechdog_sonar"] = {
    init: function () {
      this.jsonInit(getMechdogSonar);
    }
  };

  javascriptGenerator.forBlock["mechdog_sonar"] = function () {
    return ["getMechdogSonarDistance()", Order.FUNCTION_CALL];
  };

  /////////
  var blockly_print = {
    message0: "print %1",
    args0: [{ type: "input_value", name: "val", check: null }],
    previousStatement: null,
    nextStatement: null,
    colour: 330
  };

  Blockly.Blocks["print"] = {
    init: function () {
      this.jsonInit(blockly_print);
    }
  };

  javascriptGenerator.forBlock["print"] = function (block) {
    var text = javascriptGenerator.valueToCode(block, "val", Order.ATOMIC);
    var code = `blockly_print(${text});\n`;
    return code;
  };



  javascriptGenerator.forBlock["csv_save"] = function (block, generator) {
    var filename = block.getFieldValue("FILENAME");
    var duration = generator.valueToCode(block, "DURATION", Order.ATOMIC) || "5";
    var code = `saveDataToCSV("${filename}", ${duration});\n`;
    return code;
  };

  // 1. Define the block’s JSON
  const muscleEnergyJson = {
    type: "muscle_energy",
    message0: "muscle energy",
    output: "Number",
    colour: 230,
    tooltip: "Current EMG muscle‐energy value",
    helpUrl: ""
  };

  // 2. Tell Blockly about the block
  Blockly.Blocks["muscle_energy"] = {
    init: function () {
      this.jsonInit(muscleEnergyJson);
    }
  };

  // 3. Generate JS for the block: read from window.filteredSample
  javascriptGenerator.forBlock["muscle_energy"] = function (block) {
    // Call the host-registered function:
    return ["getMuscleEnergy()", Order.NONE];
  };



};

///

var wait_block = {
  type: "wait_seconds",
  message0: " wait %1 seconds",
  args0: [
    {
      type: "field_number",
      name: "SECONDS",
      min: 0,
      max: 600,
      value: 1
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: "%{BKY_LOGIC_HUE}"
};

Blockly.Blocks["wait_seconds"] = {
  init: function () {
    this.jsonInit(wait_block);
  }
};

javascriptGenerator.forBlock["wait_seconds"] = function (block) {
  var seconds = Number(block.getFieldValue("SECONDS"));
  var code = "wait_seconds(" + seconds + ");\n";
  return code;
};

//////
/* droneUp() */
var droneUp = {
  type: "drone_up",
  message0: "Right %1 cm",
  args0: [{ type: "input_value", name: "value", check: "Number" }],
  previousStatement: null,
  nextStatement: null,
  colour: 230
};

Blockly.Blocks["drone_up"] = {
  init: function () {
    this.jsonInit(droneUp);
  }
};

javascriptGenerator.forBlock["drone_up"] = function (block, generator) {
  var value = generator.valueToCode(block, "value", Order.NONE);
  var code = `drone_up(${value});\n`;
  return code;
};

//////////

/* droneDown() */
var droneDown = {
  type: "drone_down",
  message0: "Left %1 cm",
  args0: [{ type: "input_value", name: "value", check: "Number" }],
  previousStatement: null,
  nextStatement: null,
  colour: 230
};

Blockly.Blocks["drone_down"] = {
  init: function () {
    this.jsonInit(droneDown);
  }
};

javascriptGenerator.forBlock["drone_down"] = function (block, generator) {
  var value = generator.valueToCode(block, "value", Order.NONE);
  var code = `drone_down(${value});\n`;
  return code;
};

//////////
/* droneForward() */
var droneForward = {
  type: "drone_forward",
  message0: "forward %1 cm",
  args0: [{ type: "input_value", name: "value", check: "Number" }],
  previousStatement: null,
  nextStatement: null,
  colour: 230
};

Blockly.Blocks["drone_forward"] = {
  init: function () {
    this.jsonInit(droneForward);
  }
};

javascriptGenerator.forBlock["drone_forward"] = function (block, generator) {
  var value = generator.valueToCode(block, "value", Order.NONE);
  var code = `drone_forward(${value});\n`;
  return code;
};

//////////
/* droneBack() */
var droneBack = {
  type: "drone_back",
  message0: "back %1 cm",
  args0: [{ type: "input_value", name: "value", check: "Number" }],
  previousStatement: null,
  nextStatement: null,
  colour: 230
};

Blockly.Blocks["drone_back"] = {
  init: function () {
    this.jsonInit(droneBack);
  }
};

javascriptGenerator.forBlock["drone_back"] = function (block, generator) {
  var value = generator.valueToCode(block, "value", Order.NONE);
  var code = `drone_back(${value});\n`;
  return code;
};

//////////
/* ccw() */
var ccw = {
  type: "ccw",
  message0: "rotate counter-clockwise %1 degrees",
  args0: [{ type: "input_value", name: "value", check: "Number" }],
  previousStatement: null,
  nextStatement: null,
  colour: 230
};

Blockly.Blocks["ccw"] = {
  init: function () {
    this.jsonInit(ccw);
  }
};

javascriptGenerator.forBlock["ccw"] = function (block, generator) {
  var value = generator.valueToCode(block, "value", Order.NONE);
  var code = `ccw(${value});\n`;
  return code;
};

//////////
/* cw() */
var cw = {
  type: "cw",
  message0: "rotate clockwise %1 degrees",
  args0: [{ type: "input_value", name: "value", check: "Number" }],
  previousStatement: null,
  nextStatement: null,
  colour: 230
};

Blockly.Blocks["cw"] = {
  init: function () {
    this.jsonInit(cw);
  }
};

javascriptGenerator.forBlock["cw"] = function (block, generator) {
  var value = generator.valueToCode(block, "value", Order.NONE);
  var code = `cw(${value});\n`;
  return code;
};

//////
/* takeoff() */
var takeoff = {
  type: "takeoff",
  message0: "takeoff",
  args0: [],
  previousStatement: null,
  nextStatement: null,
  colour: 230
};

Blockly.Blocks["takeoff"] = {
  init: function () {
    this.jsonInit(takeoff);
  }
};

javascriptGenerator.forBlock["takeoff"] = function (block, generator) {
  var code = `takeoff();\n`;
  return code;
};

/* land() */
var land = {
  type: "land",
  message0: "land",
  args0: [],
  previousStatement: null,
  nextStatement: null,
  colour: 100
};

Blockly.Blocks["land"] = {
  init: function () {
    this.jsonInit(land);
  }
};

javascriptGenerator.forBlock["land"] = function (block, generator) {
  var code = `land();\n`;
  return code;
};

var moveBlock = {
  type: "move",
  message0: "move %1 cm at heading %2°",
  args0: [
    { type: "field_number", name: "DISTANCE", value: 100, min: 0 },
    { type: "field_number", name: "HEADING", value: 0, min: 0, max: 360 }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 160
};

Blockly.Blocks["move"] = {
  init: function () {
    this.jsonInit(moveBlock);
  }
};

javascriptGenerator.forBlock["move"] = function (block) {
  var distance = block.getFieldValue("DISTANCE");
  var heading = block.getFieldValue("HEADING");
  var code = `electronAPI.sendCommand({ action: "move", distance: ${distance}, heading: ${heading} });\n`;
  console.log("Generated code for move block:", code);
  return code;
};

// LED Control Block
var ledControl = {
  type: "led_control",
  message0: "turn LED %1",
  args0: [
    {
      type: "field_dropdown",
      name: "COLOR",
      options: [
        ["Red", "RED"],
        ["Green", "GREEN"],
        ["Blue", "BLUE"],
        ["White", "WHITE"],
        ["Yellow", "YELLOW"],
        ["Orange", "ORANGE"],
        ["Purple", "PURPLE"],
        ["Cyan", "CYAN"]
      ]
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 160
};

Blockly.Blocks["led_control"] = {
  init: function () {
    this.jsonInit(ledControl);
  }
};

javascriptGenerator.forBlock["led_control"] = function (block) {
  var color = block.getFieldValue("COLOR");
  var code = `electronAPI.sendCommand({ action: "led_on", color: "${color}" });\n`;
  console.log("Generated code for LED block:", code);
  return code;
};

// VEX Turn Left Block (simplified - no degrees input)
var vexTurnLeft = {
  type: "vex_turn_left",
  message0: "turn left",
  args0: [], // Remove the degrees input
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_turn_left"] = {
  init: function () {
    this.jsonInit(vexTurnLeft);
  }
};

javascriptGenerator.forBlock["vex_turn_left"] = function (block, generator) {
  // Use a default value of 90 degrees since there's no input
  return `vex_turn_left(90);\n`;
};

// VEX Turn Right Block (simplified - no degrees input)
var vexTurnRight = {
  type: "vex_turn_right",
  message0: "turn right",
  args0: [], // Remove the degrees input
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_turn_right"] = {
  init: function () {
    this.jsonInit(vexTurnRight);
  }
};

javascriptGenerator.forBlock["vex_turn_right"] = function (block, generator) {
  // Use a default value of 90 degrees since there's no input
  return `vex_turn_right(90);\n`;
};

// VEX Forward Block
var vexForward = {
  type: "vex_forward",
  message0: "forward %1 inches",
  args0: [
    {
      type: "input_value",
      name: "distance",
      check: "Number"
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_forward"] = {
  init: function () {
    this.jsonInit(vexForward);
  }
};

javascriptGenerator.forBlock["vex_forward"] = function (block, generator) {
  var distance = generator.valueToCode(block, "distance", Order.ATOMIC) || "4";
  return `vex_forward(${distance});\n`;
};

// VEX Back Block
var vexBack = {
  type: "vex_back",
  message0: "back %1 inches",
  args0: [
    {
      type: "input_value",
      name: "distance",
      check: "Number"
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_back"] = {
  init: function () {
    this.jsonInit(vexBack);
  }
};

javascriptGenerator.forBlock["vex_back"] = function (block, generator) {
  var distance = generator.valueToCode(block, "distance", Order.ATOMIC) || "4";
  return `vex_back(${distance});\n`;
};

// VEX Left Block
var vexLeft = {
  type: "vex_left",
  message0: "left %1 inches",
  args0: [
    {
      type: "input_value",
      name: "distance",
      check: "Number"
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_left"] = {
  init: function () {
    this.jsonInit(vexLeft);
  }
};

javascriptGenerator.forBlock["vex_left"] = function (block, generator) {
  var distance = generator.valueToCode(block, "distance", Order.ATOMIC) || "4";
  return `vex_left(${distance});\n`;
};

// VEX Right Block
var vexRight = {
  type: "vex_right",
  message0: "right %1 inches",
  args0: [
    {
      type: "input_value",
      name: "distance",
      check: "Number"
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_right"] = {
  init: function () {
    this.jsonInit(vexRight);
  }
};

javascriptGenerator.forBlock["vex_right"] = function (block, generator) {
  var distance = generator.valueToCode(block, "distance", Order.ATOMIC) || "4";
  return `vex_right(${distance});\n`;
};

// MechDog Back Block
var mechdogBack = {
  type: "mechdog_back",
  message0: "back %1 inches",
  args0: [
    {
      type: "input_value",
      name: "distance",
      check: "Number"
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["mechdog_back"] = {
  init: function () {
    this.jsonInit(mechdogBack);
  }
};

javascriptGenerator.forBlock["mechdog_back"] = function (block, generator) {
  var distance = generator.valueToCode(block, "distance", Order.ATOMIC) || "4";
  return `mechdog_back(${distance});\n`;
};

const MECHDOG_HANDSHAKE_WAIT_SECONDS = 4;
const MECHDOG_BOXING_WAIT_SECONDS = 8;

var mechdogHandshake = {
  type: "mechdog_handshake",
  message0: "handshake",
  args0: [],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["mechdog_handshake"] = {
  init: function () {
    this.jsonInit(mechdogHandshake);
  }
};

javascriptGenerator.forBlock["mechdog_handshake"] = function () {
  return `mechdog_handshake();\nwait_seconds(${MECHDOG_HANDSHAKE_WAIT_SECONDS});\n`;
};

var mechdogBoxing = {
  type: "mechdog_boxing",
  message0: "boxing",
  args0: [],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["mechdog_boxing"] = {
  init: function () {
    this.jsonInit(mechdogBoxing);
  }
};

javascriptGenerator.forBlock["mechdog_boxing"] = function () {
  return `mechdog_boxing();\nwait_seconds(${MECHDOG_BOXING_WAIT_SECONDS});\n`;
};

// VEX Kicker Block
var vexKicker = {
  type: "vex_kicker",
  message0: "kicker %1",
  args0: [
    {
      type: "field_dropdown",
      name: "ACTION",
      options: [
        ["Kick Hard", "HARD"],
        ["Kick Soft", "SOFT"],
        ["Place", "PLACE"]
      ]
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 70
};

Blockly.Blocks["vex_kicker"] = {
  init: function () {
    this.jsonInit(vexKicker);
  }
};

javascriptGenerator.forBlock["vex_kicker"] = function (block, generator) {
  var action = block.getFieldValue("ACTION");
  // Call the interpreter-exposed wrapper function so this works when run in the
  // js-interpreter as well as when generating code.
  var code = `vex_kicker("${action.toLowerCase()}");\n`;
  return code;
};
