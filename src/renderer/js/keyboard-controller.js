const KEYBOARD_BINDINGS = {
  ArrowUp: { label: "Up Arrow", description: "Forward", command: { action: "move", distance: 2, heading: 0 }, repeat: true },
  ArrowDown: { label: "Down Arrow", description: "Back", command: { action: "move", distance: 2, heading: 180 }, repeat: true },
  ArrowLeft: { label: "Left Arrow", description: "Left", command: { action: "move", distance: 2, heading: 270 }, repeat: true },
  ArrowRight: { label: "Right Arrow", description: "Right", command: { action: "move", distance: 2, heading: 90 }, repeat: true },
  Space: { label: "Space", description: "Stop", command: { action: "stop" }, repeat: false }
};

const KEYBOARD_CONTROL_ROWS = [
  { description: "Forward", keys: ["ArrowUp"] },
  { description: "Back", keys: ["ArrowDown"] },
  { description: "Left", keys: ["ArrowLeft"] },
  { description: "Right", keys: ["ArrowRight"] },
  { description: "Stop", keys: ["Space"] }
];

const MECHDOG_EMOTES = [
  { type: "handshake", label: "Handshake", command: { action: "mechdog_action", type: "handshake" } },
  { type: "boxing", label: "Boxing", command: { action: "mechdog_action", type: "boxing" } }
];

export class KeyboardController {
  constructor(sessionConfig) {
    this.sessionConfig = sessionConfig;
    this.active = false;
    this.outputTarget = "mechdog";
    this.heldKeys = new Set();
    this.sentOneShotKeys = new Set();
    this.interval = null;
    this.repeatMs = 300;
    this.lastCommand = "Idle";

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handlePanelClick = this.handlePanelClick.bind(this);
  }

  initialize() {
    this.renderPanel();
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);

    const panel = document.getElementById("keyboard-control-panel");
    panel?.addEventListener("click", this.handlePanelClick);

    this.sessionConfig.onChange((session, inputDevice, outputTarget, controlMode) => {
      this.outputTarget = outputTarget.id;
      this.setActive(controlMode.id === "keyboard");
    });
  }

  setActive(active) {
    this.active = active;
    document.body.dataset.keyboardMode = active ? "active" : "inactive";
    this.clearHeldKeys();
    this.updatePanel();

    if (active && !this.interval) {
      this.interval = window.setInterval(() => this.tick(), this.repeatMs);
    } else if (!active && this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  }

  renderPanel() {
    const panel = document.getElementById("keyboard-control-panel");
    if (!panel) return;

    const controls = KEYBOARD_CONTROL_ROWS
      .map((row) => `
        <div class="keyboard-control-key" data-keys="${row.keys.join(" ")}">
          ${this.renderKeycap(KEYBOARD_BINDINGS[row.keys[0]])}
          <span>${row.description}</span>
        </div>
      `)
      .join("");

    const emotes = MECHDOG_EMOTES
      .map((emote) => `<button type="button" class="ui mini button keyboard-emote-button" data-emote="${emote.type}">${emote.label}</button>`)
      .join("");

    panel.innerHTML = `
      <div class="keyboard-control-header">Keyboard Control</div>
      <div class="keyboard-control-grid">${controls}</div>
      <div class="keyboard-emote-header">Emotes</div>
      <div class="keyboard-emote-grid">${emotes}</div>
      <div id="keyboard-control-status">Idle</div>
    `;
  }

  renderKeycap(binding) {
    return `<span class="keyboard-keycap">${binding.label}</span>`;
  }

  handleKeyDown(event) {
    if (!this.active || this.shouldIgnoreEvent(event)) return;

    const binding = KEYBOARD_BINDINGS[event.code];
    if (!binding) return;

    event.preventDefault();
    const isFirstPress = !this.heldKeys.has(event.code);
    this.heldKeys.add(event.code);

    if (isFirstPress && (binding.repeat || !this.sentOneShotKeys.has(event.code))) {
      this.sendBinding(event.code, binding);
      if (!binding.repeat) {
        this.sentOneShotKeys.add(event.code);
      }
    }

    this.updatePanel();
  }

  handleKeyUp(event) {
    if (!KEYBOARD_BINDINGS[event.code]) return;
    this.heldKeys.delete(event.code);
    this.sentOneShotKeys.delete(event.code);
    this.updatePanel();
  }

  handlePanelClick(event) {
    const button = event.target?.closest?.("[data-emote]");
    if (!button || !this.active) return;

    const emote = MECHDOG_EMOTES.find((item) => item.type === button.dataset.emote);
    if (!emote) return;

    this.sendCommand(emote.command, emote.label);
    button.classList.add("sent");
    window.setTimeout(() => button.classList.remove("sent"), 120);
  }

  handleBlur() {
    this.clearHeldKeys();
    this.updatePanel();
  }

  tick() {
    if (!this.active) return;

    for (const code of this.heldKeys) {
      const binding = KEYBOARD_BINDINGS[code];
      if (binding?.repeat) {
        this.sendBinding(code, binding);
      }
    }
  }

  sendBinding(code, binding) {
    this.sendCommand(binding.command, `${binding.label}: ${binding.description}`);
    this.flashKey(code);
  }

  sendCommand(command, label) {
    window.electronAPI?.sendCommand?.(command);
    this.lastCommand = label;
    window.neuroConsole?.print?.(this.lastCommand, "info");
    this.updatePanel();
  }

  shouldIgnoreEvent(event) {
    const tagName = event.target?.tagName?.toLowerCase();
    return tagName === "input" || tagName === "textarea" || event.target?.isContentEditable;
  }

  clearHeldKeys() {
    this.heldKeys.clear();
    this.sentOneShotKeys.clear();
  }

  flashKey(code) {
    const binding = KEYBOARD_BINDINGS[code];
    if (!binding) return;

    const element = document.querySelector(`.keyboard-control-key[data-keys~="${code}"]`);
    if (!element) return;

    element.classList.add("sent");
    window.setTimeout(() => element.classList.remove("sent"), 120);
  }

  updatePanel() {
    const panel = document.getElementById("keyboard-control-panel");
    if (!panel) return;

    panel.classList.toggle("is-active", this.active);

    Object.keys(KEYBOARD_BINDINGS).forEach((code) => {
      const element = panel.querySelector(`.keyboard-control-key[data-keys~="${code}"]`);
      element?.classList.toggle("pressed", this.heldKeys.has(code));
    });

    const status = document.getElementById("keyboard-control-status");
    if (status) {
      status.textContent = this.active ? this.lastCommand : "Select Keyboard input";
    }
  }
}
