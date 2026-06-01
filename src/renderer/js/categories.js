export const Categories = {
  cat_logic: {
    name: "Logic",
    colour: "%{BKY_LOGIC_HUE}",
    modules: ["controls_if", "controls_ifelse", "logic_compare", "wait_seconds"]
  },

  cat_loops: {
    name: "Loops",
    colour: "%{BKY_LOOPS_HUE}",
    modules: ["controls_repeat"]
  },

  cat_math: {
    name: "Math",
    colour: "%{BKY_MATH_HUE}",
    modules: ["math_number", "math_arithmetic", "math_random_float"]
  },

  cat_sep: {
    gap: 0
  },

  cat_data: {
    name: "Data",
    colour: 330,
    modules: ["print", "muscle_energy"]
  },

  cat_drone: {
    name: "Drone",
    colour: 230,
    modules: [
      "drone_up",
      "drone_down",
      "drone_forward",
      "drone_back",
      "cw",
      "ccw",
      "takeoff",
      "land"
    ]
  },

  cat_mechdog: {
    name: "MechDog",
    colour: 70,
    modules: [
      "mechdog_forward_distance",
      "mechdog_backward_distance",
      "vex_turn_left",
      "vex_turn_right",
      "mechdog_stop",
      "mechdog_handshake",
      "mechdog_boxing"
    ]
  },

  cat_mechdog_advanced: {
    name: "Advanced",
    colour: 70,
    modules: [
      "mechdog_battery",
      "mechdog_sonar",
      "mechdog_drive_values",
      "mechdog_turn_left_steering",
      "mechdog_turn_right_steering"
    ]
  },

  cat_vars: {
    name: "Variables",
    colour: 100,
    custom: "VARIABLE",
    modules: []
  },

  cat_list: {
    name: "List",
    colour: 50,
    modules: ["lists_create_empty", "lists_create_with"]
  }
};
