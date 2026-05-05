//import { TensorDSP } from "./tensor-dsp.js";
import { ChannelVis } from "./channel_vis.js";

export const Signal = class {
  constructor(buffer_size = 256) {
    this.channels = {};
    this.channels_d3_plot = {};
    this.BUFFER_SIZE = buffer_size;
    this.channel_vis = new ChannelVis();
    this.signal_value_dom = document.querySelector("#signal-value");
    this.last_signal_update = Date.now();
    this.value_refresh_delay_ms = 100;
    this.EMG_SIGNAL_MULTIPLIER = 10000000;
    this.emg_display_multiplier = 100000;
    this.filter = null;

    if (window.Fili || window.fili) {
      const Fili = window.Fili || window.fili;
      const firCalculator = new Fili.FirCoeffs();
      const coeffs = firCalculator.lowpass({
        order: 100,
        Fs: 250,
        Fc: 3
      });
      this.filter = new Fili.FirFilter(coeffs);
    }
    //this.tensor = new TensorDSP("muse");

    /*
    setInterval(() => {
      
    }, 1000);
    */

    // If filtered preview is needed consider adding a filtered_channels object that holds a filtered copy of the raw data.
    // You could use the shift function on this data also to implement real-time filtered data visualization.
    // This will come with a computational cost.
  }

  setDeviceMode(deviceId) {
    this.channels = {};
    this.channels_d3_plot = {};
    this.channel_vis.configure(
      deviceId === "ganglion"
        ? { channelCount: 1, heightRatio: 0.36 }
        : { channelCount: 4, heightRatio: 0.09 }
    );
  }

  add_data_ganglion(sample, electrode = 0) {
    const sourceValue = Number(sample?.data?.[0]);
    if (!Number.isFinite(sourceValue)) {
      return;
    }

    const amplifiedSample = Math.abs(sourceValue * this.EMG_SIGNAL_MULTIPLIER);
    const filteredData = this.filter ? this.filter.singleStep(amplifiedSample) : amplifiedSample;
    const displayValue = Math.abs(sourceValue * this.emg_display_multiplier);

    if (this.signal_value_dom && Date.now() - this.last_signal_update > this.value_refresh_delay_ms) {
      this.signal_value_dom.textContent = displayValue.toFixed(2);
      this.last_signal_update = Date.now();
    }

    window.filteredSample = displayValue.toFixed(2);

    if (!this.channels[electrode]) {
      this.channels[electrode] = [];
      this.channels_d3_plot[electrode] = [];
    }

    if (this.channels[electrode].length > this.BUFFER_SIZE - 1) {
      this.channels[electrode].shift();
    }

    this.channels[electrode].push(displayValue);
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
    if (!this.channels[electrode] || !this.channel_vis?.svgs?.[electrode]) {
      return;
    }

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
