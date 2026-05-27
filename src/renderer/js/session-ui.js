import { INPUT_DEVICES, OUTPUT_TARGETS } from "./session-config.js";

export class SessionUI {
  constructor(sessionConfig) {
    this.sessionConfig = sessionConfig;
  }

  initialize() {
    this.bindOptionButtons("input-device-option", "inputDevice");
    this.bindOptionButtons("output-target-option", "outputTarget");

    const changeButton = document.getElementById("session-change");
    if (changeButton) {
      changeButton.addEventListener("click", () => this.openModal());
    }

    const startButton = document.getElementById("session-start");
    if (startButton) {
      startButton.addEventListener("click", () => this.closeModal());
    }

    this.sessionConfig.onChange((session, inputDevice, outputTarget) => {
      this.render(session, inputDevice, outputTarget);
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

  render(session, inputDevice, outputTarget) {
    this.renderSummary(inputDevice, outputTarget);
    this.renderOptions(session);
    this.renderConnectionHint(inputDevice, outputTarget);
  }

  renderSummary(inputDevice, outputTarget) {
    const summary = document.getElementById("session-summary");
    if (summary) {
      summary.textContent = `${inputDevice.label} -> ${outputTarget.label}`;
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
    this.setActiveOption("input-device-option", session.inputDevice);
    this.setActiveOption("output-target-option", session.outputTarget);
  }

  setActiveOption(className, activeValue) {
    document.querySelectorAll(`.${className}`).forEach((button) => {
      const isActive = button.dataset.value === activeValue;
      button.classList.toggle("primary", isActive);
      button.classList.toggle("basic", !isActive);
    });
  }

  renderConnectionHint(inputDevice, outputTarget) {
    const hint = document.getElementById("session-connection-hint");
    if (!hint) return;

    const inputConnection =
      inputDevice.bluetoothPrefixes.length > 0
        ? `${inputDevice.label} uses Bluetooth`
        : `${inputDevice.label} does not need Bluetooth`;
    const outputConnection =
      outputTarget.connectionType === "wifi"
        ? `${outputTarget.label} uses its Wi-Fi access point`
        : outputTarget.connectionType === "bluetooth"
          ? `${outputTarget.label} uses Bluetooth`
          : `${outputTarget.label} output is disabled`;

    hint.textContent = `${inputConnection}. ${outputConnection}.`;
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
  const inputContainer = document.getElementById("input-device-options");
  const outputContainer = document.getElementById("output-target-options");

  if (inputContainer) {
    inputContainer.innerHTML = Object.values(INPUT_DEVICES)
      .map((device) => optionButton("input-device-option", device.id, device.label))
      .join("");
  }

  if (outputContainer) {
    outputContainer.innerHTML = Object.values(OUTPUT_TARGETS)
      .map((target) => optionButton("output-target-option", target.id, target.label))
      .join("");
  }
}

function optionButton(className, value, label) {
  return `<button class="ui basic button ${className}" data-value="${value}">${label}</button>`;
}
