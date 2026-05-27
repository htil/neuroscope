export const INPUT_DEVICES = {
  muse: {
    id: "muse",
    label: "Muse EEG",
    signalType: "eeg",
    bluetoothPrefixes: ["Muse-"],
    panel: "bands"
  },
  ganglion: {
    id: "ganglion",
    label: "Ganglion EMG",
    signalType: "emg",
    bluetoothPrefixes: ["Ganglion-"],
    panel: "console"
  },
  keyboard: {
    id: "keyboard",
    label: "Keyboard",
    signalType: "keyboard",
    bluetoothPrefixes: [],
    panel: "console"
  }
};

export const OUTPUT_TARGETS = {
  vex: {
    id: "vex",
    label: "VEX Robot",
    connectionType: "wifi"
  },
  tello: {
    id: "tello",
    label: "Tello Drone",
    connectionType: "wifi"
  },
  mechdog: {
    id: "mechdog",
    label: "MechDog",
    connectionType: "bluetooth"
  },
  none: {
    id: "none",
    label: "None",
    connectionType: "none"
  }
};

const STORAGE_KEY = "neuroblock.session.eeg-mechdog";

export const DEFAULT_SESSION = {
  inputDevice: "muse",
  outputTarget: "mechdog"
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
    const inputDevice = INPUT_DEVICES[session.inputDevice] ? session.inputDevice : DEFAULT_SESSION.inputDevice;
    const outputTarget = OUTPUT_TARGETS[session.outputTarget] ? session.outputTarget : DEFAULT_SESSION.outputTarget;
    return { inputDevice, outputTarget };
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

  setSession(session) {
    this.current = this.normalize({ ...this.current, ...session });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
    this.emit();
  }

  onChange(listener) {
    this.listeners.add(listener);
    listener(this.getSession(), this.getInputDevice(), this.getOutputTarget());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const session = this.getSession();
    const inputDevice = this.getInputDevice();
    const outputTarget = this.getOutputTarget();
    this.listeners.forEach((listener) => listener(session, inputDevice, outputTarget));
  }
}
