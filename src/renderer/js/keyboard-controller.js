const KEYBOARD_BINDINGS = {
  KeyW: { label: "W", description: "Forward", command: { action: "move", distance: 2, heading: 0 }, repeat: true },
  KeyS: { label: "S", description: "Back", command: { action: "move", distance: 2, heading: 180 }, repeat: true },
  KeyA: { label: "A", description: "Left", command: { action: "move", distance: 2, heading: 270 }, repeat: true },
  KeyD: { label: "D", description: "Right", command: { action: "move", distance: 2, heading: 90 }, repeat: true },
  KeyQ: { label: "Q", description: "Turn Left", command: { action: "turn_left", degrees: 15 }, repeat: true },
  KeyE: { label: "E", description: "Turn Right", command: { action: "turn_right", degrees: 15 }, repeat: true },
  Space: { label: "Space", description: "Stop", command: { action: "stop" }, repeat: false }
};

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
  }

  initialize() {
    this.renderPanel();
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);

    this.sessionConfig.onChange((session, inputDevice, outputTarget) => {
      this.outputTarget = outputTarget.id;
      this.setActive(inputDevice.id === "keyboard");
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

    const controls = Object.values(KEYBOARD_BINDINGS)
      .map((binding) => `
        <div class="keyboard-control-key" data-key="${binding.label}">
          <span class="keyboard-keycap">${binding.label}</span>
          <span>${binding.description}</span>
        </div>
      `)
      .join("");

    panel.innerHTML = `
      <div class="keyboard-control-header">Keyboard Control</div>
      <div class="keyboard-control-grid">${controls}</div>
      <div id="keyboard-control-status">Idle</div>
    `;
  }

  handleKeyDown(event) {
    if (!this.active || this.shouldIgnoreEvent(event)) return;

    const binding = KEYBOARD_BINDINGS[event.code];
    if (!binding) return;

    event.preventDefault();
    this.heldKeys.add(event.code);

    if (!binding.repeat && !this.sentOneShotKeys.has(event.code)) {
      this.sendBinding(event.code, binding);
      this.sentOneShotKeys.add(event.code);
    }

    this.updatePanel();
  }

  handleKeyUp(event) {
    if (!KEYBOARD_BINDINGS[event.code]) return;
    this.heldKeys.delete(event.code);
    this.sentOneShotKeys.delete(event.code);
    this.updatePanel();
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
    window.electronAPI?.sendCommand?.(binding.command);
    this.lastCommand = `${binding.label}: ${binding.description}`;
    window.neuroConsole?.print?.(this.lastCommand, "info");
    this.flashKey(code);
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

    const element = document.querySelector(`.keyboard-control-key[data-key="${binding.label}"]`);
    if (!element) return;

    element.classList.add("sent");
    window.setTimeout(() => element.classList.remove("sent"), 120);
  }

  updatePanel() {
    const panel = document.getElementById("keyboard-control-panel");
    if (!panel) return;

    panel.classList.toggle("is-active", this.active);

    Object.entries(KEYBOARD_BINDINGS).forEach(([code, binding]) => {
      const element = panel.querySelector(`.keyboard-control-key[data-key="${binding.label}"]`);
      element?.classList.toggle("pressed", this.heldKeys.has(code));
    });

    const status = document.getElementById("keyboard-control-status");
    if (status) {
      status.textContent = this.active ? this.lastCommand : "Select Keyboard input";
    }
  }
}
