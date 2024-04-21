/*

import { Events } from "./events.js"
import { FeatureExtractor } from "./feature-extractor.js"
import {BandPowerPlot} from "./band-power-plot.js"
import {BandPowerLineGraph} from "./bp-line-graph.js"
*/

import { MuseGraph } from "./muse-graph.js";
import { BLE } from "./ble.js";
import { Events } from "./events.js";
import { Signal } from "./signal.js";
import { FeatureExtractor } from "./feature-extractor.js";
import { ChannelVis } from "./channel_vis.js";
import { BlocklyMain } from "./blockly-main.js";
import { BandPowerVis } from "./band-power-vis.js";

export const NeuroScope = class {
  constructor() {
    this.blocklyMain = new BlocklyMain();
    this.signal_handler = new Signal(512);
    this.bpBis = new BandPowerVis();
    this.events = new Events(this.blocklyMain);
    this.ble = new BLE(this.signal_handler.add_data.bind(this.signal_handler));
    this.feature_extractor = new FeatureExtractor(256);
    this.blocklyMain.start();
    setInterval(() => {
      this.signal_handler.plot_data(0);
      this.signal_handler.plot_data(1);
      this.signal_handler.plot_data(2);
      this.signal_handler.plot_data(3);

      let data = this.signal_handler.get_data();
      //let beta = this.feature_extractor.getAverageRelativeBandPower(data, "beta");
      //console.log(beta);
      let band_powers = this.feature_extractor.getFormattedBandPowers(data);
      this.bpBis.update(band_powers);

      //console.log(_data);
    }, 400);

    setTimeout(() => {
      //let test_data = { delta: 10, theta: 20, alpha: 30, beta: 40, gamma: 50 };
      //this.bpBis.update(test_data);
    }, 2000);

    //this.channel_vis = new ChannelVis();
    /*
    console.log("NeuroScope");
    this.signal_handler = new Signal(512);
    this.events = new Events();
    this.ble = new BLE(this.signal_handler.add_data.bind(this.signal_handler));
    this.blocklyMain = new BlocklyMain();

    setInterval(() => {
      this.signal_handler.plot_data(0);
      this.signal_handler.plot_data(1);
      this.signal_handler.plot_data(2);
      this.signal_handler.plot_data(3);
    }, 500);

    */
    /*
        this.muse_visualizer = new MuseGraph("graph", window.innerWidth * 0.8, window.innerHeight * 0.5, 256 * 2, 1)
        this.graph_handlers = {"muse": this.muse_visualizer}
        this.signal_handler = new Signal(this.graph_handlers, 512)
        this.feature_extractor = new FeatureExtractor(256);
        this.ble = new BLE(this.signal_handler.add_data.bind(this.signal_handler))
        this.events = new Events(this.muse_visualizer, this.ble)
        //this.bp_plot = BandPowerPlot("bpGraph", "x_axis_bp", "y_axis_bp", window.innerWidth * 0.2, window.innerWidth * 0.05, 4)
        this.bp_line_plot = BandPowerLineGraph("bp-chart", "feature", 1000)
        this.threshold = 0.15
        */
    /*
        setInterval(() => {
            //var tp9Data = [ { x: 0, y: 20 }, { x: 1, y: 10 }, { x: 2, y: 30 }, { x: 3, y: 10 }]
            //this.bp_plot.series[0].data = tp9Data
            //this.bp_plot.render()
            var data = { beta: Math.floor(Math.random() * 40) + 120 };
            this.bp_line_plot.series.addData(data);
            this.bp_line_plot.render()
            console.log("render")
        }, 1000)

        */
    /*
        setInterval(() => {
            let data = this.signal_handler.get_data()
            let beta = this.feature_extractor.getAverageRelativeBandPower(data, "beta")
            let moving_average_beta = this.feature_extractor.updateBuffer("beta", beta)
            //let feature = this.feature_extractor.getAverageBetaOverDeltaPower(data)
            let payload = {feature: moving_average_beta, threshold: this.threshold}
            this.bp_line_plot.series.addData(payload);
            window.electronAPI.controlSignal(payload)
            //console.log(beta)
            this.bp_line_plot.render()
            //console.log(feature)
            //let beta = this.feature_extractor.getRelativeBandPower(data[0], "beta")

            //console.log(out)
        }, 500);
        */
  }
};

let neuroScope = new NeuroScope();
