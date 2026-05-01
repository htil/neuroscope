import { constants, utilities } from "@openbci/utilities";
import { BehaviorSubject, Subject, filter, first, fromEvent, map, mergeMap, takeUntil, tap } from "rxjs";

const GANGLION_SERVICE = 0xfe84;
const BOARD_NAME = "ganglion";
const CHARACTERISTICS_BY_TYPE = {
  reader: "2d30c082-f39f-4ce6-923f-3484ea480596",
  writer: "2d30c083-f39f-4ce6-923f-3484ea480596",
  connection: "2d30c084-f39f-4ce6-923f-3484ea480596"
};
const ON_CHARACTERISTIC = "characteristicvaluechanged";
const ON_DISCONNECTED = "gattserverdisconnected";
const DEVICE_OPTIONS = {
  filters: [{ namePrefix: "Ganglion-" }],
  optionalServices: [GANGLION_SERVICE]
};

const COMMANDS = {
  start: "b",
  accelData: "n"
};

const renameDataProp = ({ channelData, ...sample }) => ({
  ...sample,
  data: channelData
});

export class GanglionClient {
  constructor(options = {}) {
    this.GANGLION_SERVICE = GANGLION_SERVICE;
    this.options = { ...DEVICE_OPTIONS, ...options };
    this.gatt = null;
    this.device = null;
    this.deviceName = null;
    this.service = null;
    this.characteristics = null;
    this.onDisconnect$ = new Subject();
    this.boardName = BOARD_NAME;
    this.channelSize = constants.numberOfChannelsForBoardType(BOARD_NAME);
    this.rawDataPacketToSample = constants.rawDataToSampleObjectDefault(this.channelSize);
    this.connectionStatus = new BehaviorSubject(false);
    this.stream = new Subject();
    this.readings = this.stream.pipe(
      map((event) => this.eventToBufferMapper(event)),
      tap((buffer) => this.setRawDataPacket(buffer)),
      map(() => utilities.parseGanglion(this.rawDataPacketToSample)),
      mergeMap((samples) => samples),
      map(renameDataProp),
      takeUntil(this.onDisconnect$)
    );
    this.accelData = this.readings.pipe(filter((sample) => sample.accelData.length));
  }

  eventToBufferMapper(event) {
    return new Uint8Array(event.target.value.buffer);
  }

  setRawDataPacket(buffer) {
    this.rawDataPacketToSample.rawDataPacket = buffer;
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice(this.options);
    this.addDisconnectedEvent();
    this.gatt = await this.device.gatt.connect();
    this.deviceName = this.gatt.device.name;
    this.service = await this.gatt.getPrimaryService(GANGLION_SERVICE);
    this.setCharacteristics(await this.service.getCharacteristics());
    this.connectionStatus.next(true);
    await this.start();
  }

  setCharacteristics(characteristics) {
    this.characteristics = Object.entries(CHARACTERISTICS_BY_TYPE).reduce(
      (mapByName, [name, uuid]) => ({
        ...mapByName,
        [name]: characteristics.find((characteristic) => characteristic.uuid === uuid)
      }),
      {}
    );
  }

  async start() {
    const { reader, writer } = this.characteristics;
    const commands = Object.entries(COMMANDS).reduce(
      (encodedCommands, [key, command]) => ({
        ...encodedCommands,
        [key]: new TextEncoder().encode(command)
      }),
      {}
    );

    await reader.startNotifications();
    reader.addEventListener(ON_CHARACTERISTIC, (event) => {
      this.stream.next(event);
    });

    if (this.options.accelData) {
      await writer.writeValue(commands.accelData);
      await reader.readValue();
    }

    await writer.writeValue(commands.start);
    await reader.readValue();
  }

  addDisconnectedEvent() {
    fromEvent(this.device, ON_DISCONNECTED)
      .pipe(first())
      .subscribe(() => {
        this.gatt = null;
        this.device = null;
        this.deviceName = null;
        this.service = null;
        this.characteristics = null;
        this.connectionStatus.next(false);
        this.onDisconnect$.next();
      });
  }

  disconnect() {
    if (!this.gatt) {
      return;
    }

    this.onDisconnect$.next();
    this.gatt.disconnect();
  }

  get_device() {
    return this.device;
  }
}
