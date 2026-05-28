export const INPUT_DEVICES = {
  ganglion: {
    id: "ganglion",
    label: "Ganglion EMG",
    signalType: "emg",
    bluetoothPrefixes: ["Ganglion-"],
    panel: "console"
  }
};

export const OUTPUT_TARGETS = {
  mechdog: {
    id: "mechdog",
    label: "MechDog",
    connectionType: "bluetooth"
  }
};

export const CONTROL_MODES = {
  mechdog: {
    id: "mechdog",
    label: "MechDog"
  },
  keyboard: {
    id: "keyboard",
    label: "Keyboard (WASD / Arrows)"
  }
};

const STORAGE_KEY = "neuroblock.session.emg-mechdog";

export const DEFAULT_SESSION = {
  inputDevice: "ganglion",
  outputTarget: "mechdog",
  controlMode: "mechdog"
};

export class SessionConfig {
  constructor() {
    this.listeners = new Set();
    this.current = this.readStoredSession();
  }

  readStoredSession() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      return this.normalize(stored);
    } catch {
      return { ...DEFAULT_SESSION };
    }
  }

  normalize(session = {}) {
    const controlMode = CONTROL_MODES[session.controlMode] ? session.controlMode : DEFAULT_SESSION.controlMode;
    return {
      inputDevice: DEFAULT_SESSION.inputDevice,
      outputTarget: DEFAULT_SESSION.outputTarget,
      controlMode
    };
  }

  getSession() {
    return { ...this.current };
  }

  getInputDevice() {
    return INPUT_DEVICES[this.current.inputDevice];
  }

  getOutputTarget() {
    return OUTPUT_TARGETS[this.current.outputTarget];
  }

  getControlMode() {
    return CONTROL_MODES[this.current.controlMode];
  }

  setSession(session) {
    this.current = this.normalize({ ...this.current, ...session });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
    this.emit();
  }

  onChange(listener) {
    this.listeners.add(listener);
    listener(this.getSession(), this.getInputDevice(), this.getOutputTarget(), this.getControlMode());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const session = this.getSession();
    const inputDevice = this.getInputDevice();
    const outputTarget = this.getOutputTarget();
    const controlMode = this.getControlMode();
    this.listeners.forEach((listener) => listener(session, inputDevice, outputTarget, controlMode));
  }
}
