//import { TensorDSP } from "./tensor-dsp.js";
import { ChannelVis } from "./channel_vis.js";

export const Signal = class {
  constructor(buffer_size = 256, device = "muse") {
    this.channels = {};
    this.channels_d3_plot = {};
    this.BUFFER_SIZE = buffer_size;
    let signal_div_height = device === "ganglion" ? 0.5 : 0.09; // For now if device is muse, we use 0.09, if device is ganglion, we use 0.2
    this.x_top_padding = device === "ganglion" ? window.innerHeight * 3 : 0;
    console.log("top padding", this.x_top_padding);
    this.channel_vis = new ChannelVis(signal_div_height);
    this.signal_value_dom = document.querySelector("#signal_value");
    this.last_signal_update = Date.now();
    this.value_refresh_delay_ms = 100;
    this.EMG_SIGNAL_MULTIPLIER = 10000000;
    let Fili = window.fili;
    this.sampleRate = 250;
    // this.lowFreq = lowFreq;
    // this.highFreq = highFreq;
    this.filterOrder = 100;
    this.firCalculator = new Fili.FirCoeffs();
    this.coeffs = this.firCalculator.lowpass({
      order: this.filterOrder,
      Fs: this.sampleRate,
      Fc: 3
    });

    this.filter = new Fili.FirFilter(this.coeffs);
    //this.tensor = new TensorDSP("muse");

    /*
    setInterval(() => {
      
    }, 1000);
    */

    // If filtered preview is needed consider adding a filtered_channels object that holds a filtered copy of the raw data.
    // You could use the shift function on this data also to implement real-time filtered data visualization.
    // This will come with a computational cost.
  }

  add_data_ganglion(sample, electrode = 0) {
    let new_sample = Math.abs(sample.data[0] * this.EMG_SIGNAL_MULTIPLIER);
    let filtered_data = this.filter.singleStep(new_sample);
    //console.log("my sample", filtered_data);
    // window.filteredSample = filtered_data;

    let value_for_kids = Math.abs(sample.data[0] * 100000).toFixed(2); // easier for students to interpret
    if (Date.now() - this.last_signal_update > this.value_refresh_delay_ms) {
      this.signal_value_dom.innerHTML = value_for_kids; // easier for students to interpret
      this.last_signal_update = Date.now();
    }

    window.filteredSample = value_for_kids;

    if (!this.channels[electrode]) {
      this.channels[electrode] = [];
      this.channels_d3_plot[electrode] = [];
    }

    if (this.channels[electrode].length > this.BUFFER_SIZE - 1) {
      this.channels[electrode].shift();
    }

    let formatted_data = filtered_data - this.x_top_padding * 1.6;
    this.channels[electrode].push(formatted_data);
    //console.log(this.channels[electrode]);
  }

  add_data(sample) {
    //console.log(sample);
    let { electrode, samples } = sample;
    if (!this.channels[electrode]) {
      this.channels[electrode] = [];
      this.channels_d3_plot[electrode] = [];
    }

    // Add all samples to current array
    for (let i in samples) {
      if (this.channels[electrode].length > this.BUFFER_SIZE - 1) {
        this.channels[electrode].shift();
        //this.channels_d3_plot[electrode].shift();
      }

      this.channels[electrode].push(samples[i]);
      let step = this.channels_d3_plot[electrode].length;
      let value = samples[i];
      //this.channels_d3_plot[electrode].push({ step, value });
      //console.log(this.channels[0]);
      //console.log(this.channels_d3_plot[electrode]);
    }

    //console.log(this.channels_d3_plot[electrode]);

    //this.channel_vis.plot_external(this.channels_d3_plot[electrode]);

    //this.update_graph_handlers(samples, electrode);
  }

  // Update all visualizers with new data
  update_graph_handlers(data, electrode) {
    //console.log(data, electrode);
    /*
    for (let i in this.graph_handlers) {
      this.graph_handlers[i].add_data(data, electrode);
    }*/
  }

  plot_data(electrode) {
    //let electrode = 0;
    this.channels_d3_plot[electrode] = [];
    for (let sample in this.channels[electrode]) {
      this.channels_d3_plot[electrode].push({
        step: sample,
        value: this.channels[electrode][sample]
      });
    }
    this.channel_vis.plot_external(electrode, this.channels_d3_plot[electrode]);
  }

  get_data() {
    return this.channels;
  }
};
