import { CONTROL_MODES } from "./session-config.js";

export class SessionUI {
  constructor(sessionConfig) {
    this.sessionConfig = sessionConfig;
  }

  initialize() {
    this.bindOptionButtons("control-mode-option", "controlMode");

    const changeButton = document.getElementById("session-change");
    if (changeButton) {
      changeButton.addEventListener("click", () => this.openModal());
    }

    const startButton = document.getElementById("session-start");
    if (startButton) {
      startButton.addEventListener("click", () => this.closeModal());
    }

    this.sessionConfig.onChange((session, inputDevice, outputTarget, controlMode) => {
      this.render(session, inputDevice, outputTarget, controlMode);
    });

    if (!window.localStorage.getItem("neuroblock.session")) {
      window.setTimeout(() => this.openModal(), 250);
    }
  }

  bindOptionButtons(className, sessionKey) {
    document.querySelectorAll(`.${className}`).forEach((button) => {
      button.addEventListener("click", () => {
        this.sessionConfig.setSession({ [sessionKey]: button.dataset.value });
      });
    });
  }

  render(session, inputDevice, outputTarget, controlMode) {
    this.renderSummary(inputDevice, outputTarget, controlMode);
    this.renderOptions(session);
    this.renderConnectionHint(outputTarget, controlMode);
  }

  renderSummary(inputDevice, outputTarget, controlMode) {
    const summary = document.getElementById("session-summary");
    if (summary) {
      summary.textContent = `${controlMode.label} Control`;
    }

    const inputLabel = document.getElementById("session-input-label");
    if (inputLabel) {
      inputLabel.textContent = inputDevice.label;
    }

    const outputLabel = document.getElementById("session-output-label");
    if (outputLabel) {
      outputLabel.textContent = outputTarget.label;
    }
  }

  renderOptions(session) {
    this.setActiveOption("control-mode-option", session.controlMode);
  }

  setActiveOption(className, activeValue) {
    document.querySelectorAll(`.${className}`).forEach((button) => {
      const isActive = button.dataset.value === activeValue;
      button.classList.toggle("primary", isActive);
      button.classList.toggle("basic", !isActive);
    });
  }

  renderConnectionHint(outputTarget, controlMode) {
    const hint = document.getElementById("session-connection-hint");
    if (!hint) return;

    hint.textContent = controlMode.id === "keyboard"
      ? "Drive MechDog with the arrow keys. Use the emote buttons for actions."
      : `${outputTarget.label} uses Bluetooth.`;
  }

  openModal() {
    if (window.$) {
      window.$("#session-modal").modal({
        closable: false
      }).modal("show");
    }
  }

  closeModal() {
    if (window.$) {
      window.$("#session-modal").modal("hide");
    }
  }
}

export function renderSessionOptions() {
  const inputContainer = document.getElementById("control-mode-options");
  if (inputContainer) {
    inputContainer.innerHTML = Object.values(CONTROL_MODES)
      .map((mode) => optionButton("control-mode-option", mode.id, mode.label))
      .join("");
  }

}

function optionButton(className, value, label) {
  return `<button class="ui basic button ${className}" data-value="${value}">${label}</button>`;
}
