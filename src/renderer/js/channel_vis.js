import * as d3 from "d3";

export const ChannelVis = class {
  constructor(options = {}) {
    this.width = window.innerWidth * 0.4;
    this.signal_amplitude = 300;
    this.svgs = {};
    this.channelIds = [];

    this.configure(options);
    this.walkX = d3
      .scaleLinear()
      .domain([0, 512])
      .range([10, this.width - 10]);

    this.walkY = d3.scaleLinear().domain([-this.signal_amplitude, this.signal_amplitude]).range([this.height - 10, 10]);

    this.line = d3
      .line()
      .x((d) => this.walkX(d.step))
      .y((d) => this.walkY(d.value));
  }

  configure(options = {}) {
    const channelCount = options.channelCount || 4;
    const heightRatio = options.heightRatio || 0.09;
    this.height = window.innerHeight * heightRatio;
    this.svgs = {};
    this.channelIds = Array.from({ length: channelCount }, (_, index) => index);

    ["0", "1", "2", "3"].forEach((divId, index) => {
      const container = document.getElementById(divId);
      if (!container) return;
      container.innerHTML = "";
      container.style.display = index < channelCount ? "block" : "none";
    });

    this.walkY = d3.scaleLinear().domain([-this.signal_amplitude, this.signal_amplitude]).range([this.height - 10, 10]);

    this.channelIds.forEach((channelId) => {
      this.add_channel(String(channelId), channelId);
    });
  }

  add_channel(div_id, channel_id) {
    this.svgs[channel_id] = d3.create("svg").attr("width", this.width).attr("height", this.height);
    // Append the SVG element.
    this.svgs[channel_id].append("path").attr("fill", "none").attr("stroke", "red");
    //container.append(this.svgs[channel_id].node());
    document.getElementById(div_id).append(this.svgs[channel_id].node());
  }

  async plot() {
    if (!this.svgs[0]) {
      return;
    }

    let data = await this.add_data();
    let line_data = this.line(data);
    this.svgs[0]
      .selectAll("path")
      .transition()
      .duration(100)
      .ease(d3.easeLinear)
      .attr("d", line_data);
  }

  plot_external(channel_id, data) {
    if (!this.svgs[channel_id] || !data || data.length === 0) {
      return;
    }

    this.updateScale(data);
    //let data = await this.add_data();
    let line_data = this.line(data);
    this.svgs[channel_id].selectAll("path").attr("d", line_data);
  }

  updateScale(data) {
    const maxValue = d3.max(data, (d) => Math.abs(Number(d.value) || 0)) || this.signal_amplitude;

    if (maxValue <= this.signal_amplitude) {
      return;
    }

    this.signal_amplitude = Math.ceil(maxValue / 50) * 50;
    this.walkY.domain([-this.signal_amplitude, this.signal_amplitude]);
  }

  async add_data() {
    const data = [];
    for (let i = 0, v = 2; i < 50; ++i) {
      v += Math.random() - 0.5;
      v = Math.max(Math.min(v, 4), 0);
      data.push({ step: i, value: v });
    }
    return data;
  }
};
