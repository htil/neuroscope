const dgram = require("node:dgram");
const { Buffer } = require("node:buffer");

class Tello {
  constructor() {
    this.io_port = 8889;
    this.state_port = 8890;
    this.host = "192.168.10.1";
    this.server = dgram.createSocket("udp4");
    this.state_info = dgram.createSocket("udp4");
    //this.state_info.bind(this.state_port);
    this.server.bind(9000);
    this.server.on("message", this._on_message);
    this.state = {};
    //this.state_info.on("message", this._on_state);
    this.state_info.on("message", (message, remote) => {
      // remote: { address: '192.168.10.1', family: 'IPv4', port: 8889, size: 127 }
      // message: <Buffer 70 69 74 63 68 ... >
      const readableMessage = message.toString();

      for (const e of readableMessage.slice(0, -1).split(";")) {
        this.state[e.split(":")[0]] = e.split(":")[1];
      }
      //console.log(this.state);
    });
    this.state_info.bind(8890, "0.0.0.0");
  }

  _on_state(msg, info) {
    //console.log(msg, info);
  }

  _on_message(msg, info) {
    //console.log(msg);
    //console.log(info);
    //console.log("Received %d bytes from %s:%d\n", msg.length, info.address, info.port);
  }

  send_message(message_text) {
    let message = Buffer.from(message_text);
    this.server.send(message, 0, message.length, this.io_port, this.host, function (err, bytes) {
      if (err) throw err;
    });
  }

  takeoff() {
    console.log("takeoff");
    this.send_message("command");
    this.send_message("takeoff");
  }

  getState() {
    return this.state;
  }

  land() {
    console.log("land");
    this.send_message("command");
    setTimeout(() => this.send_message("land"), 1000);
  }
}

// Lazy initialization - only create Tello instance when needed
let tello = null;
function getTello() {
  if (!tello) {
    console.log("Initializing Tello...");
    tello = new Tello();
  }
  return tello;
}

module.exports.takeoff = () => getTello().takeoff();
module.exports.land = () => getTello().land();
module.exports.getState = () => getTello().getState();
module.exports.up = (value) => getTello().send_message("up " + value);
module.exports.down = (value) => getTello().send_message("down " + value);
module.exports.forward = (value) => getTello().send_message("forward " + value);
module.exports.cw = (value) => getTello().send_message("cw " + value);
module.exports.ccw = (value) => getTello().send_message("ccw " + value);
module.exports.back = (value) => getTello().send_message("back " + value);
