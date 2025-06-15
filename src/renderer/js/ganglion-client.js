import { constants, debug, utilities } from "@openbci/utilities";
// import { fromEvent, merge, Subject, BehaviorSubject } from "rxjs";
import {
  fromEvent,
  merge,
  Subject,
  BehaviorSubject,
  tap,
  first,
  map,
  takeUntil,
  scan,
  concatMap,
  filter,
  share,
  mergeMap,
  fromEvent
} from "rxjs";

let parseGanglion = utilities.parseGanglion;
let numberOfChannelsForBoardType = constants.numberOfChannelsForBoardType;
let rawDataToSampleObjectDefault = constants.rawDataToSampleObjectDefault;

const serviceId = 0xfe84;
const boardName = "ganglion";
const characteristicsByType = {
  reader: "2d30c082-f39f-4ce6-923f-3484ea480596",
  writer: "2d30c083-f39f-4ce6-923f-3484ea480596",
  connection: "2d30c084-f39f-4ce6-923f-3484ea480596"
};
const onCharacteristic = "characteristicvaluechanged";
const onDisconnected = "gattserverdisconnected";
const deviceOptions = {
  filters: [{ namePrefix: "Ganglion-" }],
  optionalServices: [serviceId]
};

const commandStrings = {
  start: "b",
  accelData: "n"
};

const renameDataProp = ({ channelData, ...sample }) => ({
  ...sample,
  data: channelData
});

export const GanglionClient = class {
  constructor(options = {}) {
    this.GANGLION_SERVICE = serviceId;
    // this.MUSE_SERVICE = 0xfe8d;
    this.options = deviceOptions;
    this.signalMultiplier = 10000;
    this.gatt = null;
    this.device = null;
    this.deviceName = null;
    this.service = null;
    this.characteristics = null;
    this.onDisconnect$ = new Subject();
    this.boardName = boardName;
    this.channelSize = numberOfChannelsForBoardType(boardName);
    this.rawDataPacketToSample = rawDataToSampleObjectDefault(this.channelSize);
    this.connectionStatus = new BehaviorSubject(false);
    this.stream = new Subject().pipe(
      map((event) => this.eventToBufferMapper(event)),
      tap((buffer) => this.setRawDataPacket(buffer)),
      map(() => parseGanglion(this.rawDataPacketToSample)),
      mergeMap((x) => x),
      map(renameDataProp),
      takeUntil(this.onDisconnect$)
    );
    this.accelData = this.stream.pipe(filter((sample) => sample.accelData.length));
  }

  eventToBufferMapper(event) {
    return new Uint8Array(event.target.value.buffer);
  }

  setRawDataPacket(buffer) {
    this.rawDataPacketToSample.rawDataPacket = buffer;
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice(deviceOptions);
    this.addDisconnectedEvent();
    this.gatt = await this.device.gatt.connect();
    this.deviceName = this.gatt.device.name;
    this.service = await this.gatt.getPrimaryService(serviceId);
    this.setCharacteristics(await this.service.getCharacteristics());
    this.connectionStatus.next(true);

    await this.start();

    // this.stream.subscribe((sample) => {
    //   //console.log(sample.data);
    //   let new_sample = sample.data[0] * this.signalMultiplier;
    //   console.log(new_sample);
    // });

    //console.log(this.device);
    //console.log(utilities.parseGanglion);
  }

  setCharacteristics(characteristics) {
    this.characteristics = Object.entries(characteristicsByType).reduce(
      (map, [name, uuid]) => ({
        ...map,
        [name]: characteristics.find((c) => c.uuid === uuid)
      }),
      {}
    );
  }

  async start() {
    const { reader, writer } = this.characteristics;
    const commands = Object.entries(commandStrings).reduce(
      (acc, [key, command]) => ({
        ...acc,
        [key]: new TextEncoder().encode(command)
      }),
      {}
    );

    reader.startNotifications();
    reader.addEventListener(onCharacteristic, (event) => {
      this.stream.next(event);
    });

    if (this.options.accelData) {
      await writer.writeValue(commands.accelData);
      reader.readValue();
    }
    await writer.writeValue(commands.start);
    reader.readValue();
  }

  addDisconnectedEvent() {
    fromEvent(this.device, onDisconnected)
      .pipe(first())
      .subscribe(() => {
        this.gatt = null;
        this.device = null;
        this.deviceName = null;
        this.service = null;
        this.characteristics = null;
        this.connectionStatus.next(false);
      });
  }

  disconnect() {
    if (!this.gatt) {
      return;
    }
    this.onDisconnect$.next();
    this.gatt.disconnect();
  }
};
