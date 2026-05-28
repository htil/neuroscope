export class SessionUI {
  constructor(sessionConfig) {
    this.sessionConfig = sessionConfig;
  }

  initialize() {
    const changeButton = document.getElementById("session-change");
    if (changeButton) {
      changeButton.addEventListener("click", () => this.toggleControlMode());
    }

    this.sessionConfig.onChange((session, inputDevice, outputTarget, controlMode) => {
      this.render(session, inputDevice, outputTarget, controlMode);
    });
  }

  toggleControlMode() {
    const current = this.sessionConfig.getSession().controlMode;
    this.sessionConfig.setSession({
      controlMode: current === "keyboard" ? "mechdog" : "keyboard"
    });
  }

  render(session, inputDevice, outputTarget, controlMode) {
    this.renderSummary(inputDevice, outputTarget, controlMode);
    this.renderConnectionHint(outputTarget, controlMode);
  }

  renderSummary(inputDevice, outputTarget, controlMode) {
    const summary = document.getElementById("session-summary");
    if (summary) {
      summary.textContent = controlMode.id === "keyboard"
        ? "Keyboard Control"
        : `${inputDevice.label} Control`;
    }

    const inputLabel = document.getElementById("session-input-label");
    if (inputLabel) {
      inputLabel.textContent = inputDevice.label;
    }

    const outputLabel = document.getElementById("session-output-label");
    if (outputLabel) {
      outputLabel.textContent = outputTarget.label;
    }

    const changeButton = document.getElementById("session-change");
    if (changeButton) {
      changeButton.textContent = controlMode.id === "keyboard"
        ? `Use ${inputDevice.label}`
        : "Use Keyboard";
    }
  }

  renderConnectionHint(outputTarget, controlMode) {
    const hint = document.getElementById("session-connection-hint");
    if (!hint) return;

    hint.textContent = controlMode.id === "keyboard"
      ? "Drive MechDog with the arrow keys. Use the emote buttons for actions."
      : `${outputTarget.label} uses Bluetooth.`;
  }
}
