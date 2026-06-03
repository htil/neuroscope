import asyncio
import json
import logging
import os
import sys
from datetime import datetime

import websockets
from bleak import BleakClient, BleakScanner


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


class MechDogController:
    def __init__(self):
        self.device_name_prefix = os.getenv("MECHDOG_NAME_PREFIX", "mechdog_").lower()
        self.device_name_match = os.getenv("MECHDOG_NAME_MATCH", "").strip().lower()
        self.configured_device_address = os.getenv("MECHDOG_ADDRESS", "").strip()
        self.device_address = self.configured_device_address
        self.write_uuid = os.getenv("MECHDOG_WRITE_UUID", "0000ffe1-0000-1000-8000-00805f9b34fb")
        self.notify_uuid = os.getenv("MECHDOG_NOTIFY_UUID", "0000ffe2-0000-1000-8000-00805f9b34fb")
        self.pair = os.getenv("MECHDOG_PAIR", "0").strip().lower() not in ("0", "false", "no")
        self.unpair_on_disconnect = os.getenv("MECHDOG_UNPAIR_ON_DISCONNECT", "1").strip().lower() not in ("0", "false", "no")

        self.command_stop = "CMD|3|0|$"
        self.command_forward = os.getenv("MECHDOG_CMD_FORWARD", "CMD|3|3|$")
        self.command_turn_right = os.getenv("MECHDOG_CMD_TURN_RIGHT", "CMD|3|1|$")
        self.command_turn_left = os.getenv("MECHDOG_CMD_TURN_LEFT", "CMD|3|5|$")
        self.command_backward = os.getenv("MECHDOG_CMD_BACKWARD", "CMD|3|7|$")
        self.drive_speed_limit = float(os.getenv("MECHDOG_DRIVE_SPEED_LIMIT", "120"))
        self.drive_steering_limit = float(os.getenv("MECHDOG_DRIVE_STEERING_LIMIT", "40"))
        self.action_commands = {
            "left_foot_kick": os.getenv("MECHDOG_CMD_LEFT_FOOT_KICK", "CMD|2|1|1|$"),
            "right_foot_kick": os.getenv("MECHDOG_CMD_RIGHT_FOOT_KICK", "CMD|2|1|2|$"),
            "stand_four_legs": os.getenv("MECHDOG_CMD_STAND_FOUR_LEGS", "CMD|2|1|3|$"),
            "sit_dowm": os.getenv("MECHDOG_CMD_SIT_DOWM", "CMD|2|1|4|$"),
            "go_prone": os.getenv("MECHDOG_CMD_GO_PRONE", "CMD|2|1|5|$"),
            "stand_two_legs": os.getenv("MECHDOG_CMD_STAND_TWO_LEGS", "CMD|2|1|6|$"),
            "handshake": os.getenv("MECHDOG_CMD_HANDSHAKE", "CMD|2|1|7|$"),
            "scrape_a_bow": os.getenv("MECHDOG_CMD_SCRAPE_A_BOW", "CMD|2|1|8|$"),
            "nodding_motion": os.getenv("MECHDOG_CMD_NODDING_MOTION", "CMD|2|1|9|$"),
            "boxing": os.getenv("MECHDOG_CMD_BOXING", "CMD|2|1|10|$"),
            "stretch_oneself": os.getenv("MECHDOG_CMD_STRETCH_ONESELF", "CMD|2|1|11|$"),
            "pee": os.getenv("MECHDOG_CMD_PEE", "CMD|2|1|12|$"),
            "press_up": os.getenv("MECHDOG_CMD_PRESS_UP", "CMD|2|1|13|$"),
            "rotation_pitch": os.getenv("MECHDOG_CMD_ROTATION_PITCH", "CMD|2|1|14|$"),
            "rotation_roll": os.getenv("MECHDOG_CMD_ROTATION_ROLL", "CMD|2|1|15|$"),
        }
        self.command_battery = os.getenv("MECHDOG_CMD_BATTERY", "CMD|6|$")
        self.command_sonar = os.getenv("MECHDOG_CMD_SONAR", "CMD|4|1|$")

        self.move_seconds_per_unit = float(os.getenv("MECHDOG_MOVE_SECONDS_PER_UNIT", "0.15"))
        self.turn_seconds_per_90 = float(os.getenv("MECHDOG_TURN_SECONDS_PER_90", "0.7"))
        self.response_timeout_seconds = float(os.getenv("MECHDOG_RESPONSE_TIMEOUT_SECONDS", "3"))
        self.connect_timeout_seconds = float(os.getenv("MECHDOG_CONNECT_TIMEOUT_SECONDS", "15"))
        self.disconnect_timeout_seconds = float(os.getenv("MECHDOG_DISCONNECT_TIMEOUT_SECONDS", "6"))
        self.unpair_timeout_seconds = float(os.getenv("MECHDOG_UNPAIR_TIMEOUT_SECONDS", "8"))

        self.client = None
        self.connected = False
        self.device_name = None
        self.last_error = None
        self.battery_raw_max = float(os.getenv("MECHDOG_BATTERY_RAW_MAX", "8500"))
        self.last_battery_raw = None
        self.last_battery_percent = None
        self.last_sonar_distance = None
        self._notify_started = False
        self._response_queue = asyncio.Queue()
        self._connect_lock = asyncio.Lock()
        self._motion_lock = asyncio.Lock()

    async def _find_device(self):
        if self.configured_device_address:
            logger.info("Using configured MechDog address: %s", self.configured_device_address)
            return self.configured_device_address

        if self.device_name_match:
            logger.info(
                "Scanning for MechDog with prefix '%s' and name containing '%s'...",
                self.device_name_prefix,
                self.device_name_match,
            )
        else:
            logger.info("Scanning for MechDog with prefix '%s'...", self.device_name_prefix)

        devices = await BleakScanner.discover(timeout=8.0)
        for device in devices:
            device_name = (device.name or "").lower()
            is_mechdog_name = device_name.startswith(self.device_name_prefix)
            if self.device_name_match:
                device_matches = is_mechdog_name and self.device_name_match in device_name
            else:
                device_matches = is_mechdog_name

            if device_matches:
                self.device_name = device.name
                self.device_address = device.address
                logger.info("Found MechDog: %s (%s)", device.name, device.address)
                return device

        if self.device_name_match:
            raise RuntimeError(
                f"MechDog not found with prefix '{self.device_name_prefix}' "
                f"and name containing '{self.device_name_match}'"
            )
        raise RuntimeError(f"MechDog not found for prefix '{self.device_name_prefix}'")

    def _handle_disconnect(self, _client):
        self.connected = False
        self.client = None
        self._notify_started = False
        logger.warning("MechDog BLE connection closed")

    def _handle_notification(self, _sender, data):
        try:
            payload = data.decode("utf-8", errors="ignore").strip()
        except Exception:
            payload = ""
        if not payload:
            return

        logger.info("RX %s", payload)
        try:
            self._response_queue.put_nowait(payload)
        except asyncio.QueueFull:
            pass

        parts = payload.split("|")
        if len(parts) >= 3 and parts[0] == "CMD":
            if parts[1] == "6":
                try:
                    self._set_battery_raw(int(parts[2]))
                except ValueError:
                    pass
            elif parts[1] == "4":
                try:
                    self.last_sonar_distance = int(parts[2])
                except ValueError:
                    pass

    async def _drain_response_queue(self):
        while not self._response_queue.empty():
            try:
                self._response_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

    def _battery_percent_from_raw(self, raw_battery):
        percent = round((float(raw_battery) / self.battery_raw_max) * 100)
        return max(0, min(100, percent))

    def _set_battery_raw(self, raw_battery):
        self.last_battery_raw = raw_battery
        self.last_battery_percent = self._battery_percent_from_raw(raw_battery)
        return self.last_battery_percent

    async def _start_notifications(self):
        if self._notify_started or not self.client:
            return
        await self.client.start_notify(self.notify_uuid, self._handle_notification)
        self._notify_started = True

    async def connect(self):
        async with self._connect_lock:
            if self.client and self.client.is_connected:
                self.connected = True
                return

            target = await self._find_device()
            client = BleakClient(target, pair=self.pair, disconnected_callback=self._handle_disconnect)
            await asyncio.wait_for(client.connect(), timeout=self.connect_timeout_seconds)

            self.client = client
            self.connected = bool(client.is_connected)
            self.last_error = None
            await self._start_notifications()

            if not self.device_name:
                self.device_name = getattr(target, "name", None) or "MechDog"
            if not self.device_address:
                self.device_address = getattr(target, "address", None) or self.device_address

            logger.info(
                "Connected to MechDog: %s (%s)",
                self.device_name or "unknown",
                self.device_address or "unknown",
            )

    async def disconnect(self, unpair=None):
        async with self._connect_lock:
            if self.client is not None:
                client = self.client
                try:
                    if client.is_connected:
                        try:
                            logger.info("Sending MechDog stop before disconnect")
                            await asyncio.wait_for(
                                client.write_gatt_char(self.write_uuid, self.command_stop.encode("utf-8"), response=False),
                                timeout=2,
                            )
                        except Exception as exc:
                            logger.warning("Error stopping MechDog before disconnect: %s", exc)
                    if self._notify_started and client.is_connected:
                        try:
                            await asyncio.wait_for(
                                client.stop_notify(self.notify_uuid),
                                timeout=self.disconnect_timeout_seconds,
                            )
                        except Exception as exc:
                            logger.warning("Error stopping MechDog notifications: %s", exc)
                    if client.is_connected:
                        logger.info("Disconnecting MechDog BLE client")
                        await asyncio.wait_for(client.disconnect(), timeout=self.disconnect_timeout_seconds)
                    should_unpair = self.unpair_on_disconnect if unpair is None else bool(unpair)
                    if should_unpair and hasattr(client, "unpair"):
                        try:
                            logger.info("Requesting Windows/BLE unpair for MechDog")
                            await asyncio.wait_for(client.unpair(), timeout=self.unpair_timeout_seconds)
                        except Exception as exc:
                            logger.warning("Error unpairing MechDog: %s", exc)
                except Exception as exc:
                    logger.warning("Error disconnecting MechDog: %s", exc)
                finally:
                    self.client = None
                    self.connected = False
                    self._notify_started = False
                    if not self.configured_device_address:
                        self.device_address = None

    async def ensure_connected(self):
        if self.client and self.client.is_connected:
            self.connected = True
            return

        try:
            await self.connect()
        except Exception as exc:
            self.connected = False
            self.last_error = str(exc)
            raise

    async def reconnect(self):
        await self.disconnect(unpair=True)
        await asyncio.sleep(1.0)
        await self.connect()

    async def switch_mechdog(self, name_match):
        self.device_name_match = str(name_match or "").strip().lower()
        self.last_error = None
        self.device_name = None
        if not self.configured_device_address:
            self.device_address = None

        if self.device_name_match:
            logger.info("Switching MechDog target to name containing '%s'", self.device_name_match)
        else:
            logger.info("Switching MechDog target to first device with prefix '%s'", self.device_name_prefix)

        await self.disconnect(unpair=True)
        await asyncio.sleep(1.0)
        try:
            await self.connect()
        except Exception as exc:
            self.connected = False
            self.last_error = str(exc)
            raise

    async def write_command(self, command):
        await self.ensure_connected()
        logger.info("TX %s", command)
        await self.client.write_gatt_char(self.write_uuid, command.encode("utf-8"), response=False)

    async def query_command(self, command, matcher):
        await self.ensure_connected()
        await self._drain_response_queue()
        await self.write_command(command)

        timeout_at = asyncio.get_running_loop().time() + self.response_timeout_seconds
        while True:
            remaining = timeout_at - asyncio.get_running_loop().time()
            if remaining <= 0:
                raise TimeoutError(f"Timed out waiting for MechDog response to {command}")
            payload = await asyncio.wait_for(self._response_queue.get(), timeout=remaining)
            if matcher(payload):
                return payload

    async def pulse_command(self, command, duration_s):
        async with self._motion_lock:
            motion_error = None
            try:
                await self.write_command(command)
                await asyncio.sleep(max(0.1, duration_s))
            except Exception as exc:
                motion_error = exc
                raise
            finally:
                stop_error = None
                for attempt in range(2):
                    try:
                        await self.write_command(self.command_stop)
                    except Exception as exc:
                        stop_error = exc
                        logger.warning("Failed to send MechDog stop command: %s", exc)
                    if attempt == 0:
                        await asyncio.sleep(0.05)
                if stop_error is not None and motion_error is None:
                    raise stop_error

    async def led_on(self, color_name):
        logger.info("Ignoring LED request for MechDog: %s", color_name)
        return {
            "status": "success",
            "action": "led_on",
            "message": "MechDog does not expose LED control in this backend",
            "color": color_name,
        }

    async def led_off(self):
        logger.info("Ignoring LED off request for MechDog")
        return {
            "status": "success",
            "action": "led_off",
            "message": "MechDog does not expose LED control in this backend",
        }

    async def move(self, distance, heading):
        heading = int(heading)
        distance = float(distance)

        if heading == 0:
            command = self.command_forward
        elif heading == 90:
            command = self.command_turn_right
        elif heading == 270:
            command = self.command_turn_left
        elif heading == 180 and self.command_backward:
            command = self.command_backward
        else:
            raise ValueError(
                f"Unsupported move heading {heading}. "
                "Known directions are forward (0), right turn (90), left turn (270), "
                "and optional backward (180 via MECHDOG_CMD_BACKWARD)."
            )

        duration_s = min(3.0, max(0.25, abs(distance) * self.move_seconds_per_unit))
        await self.pulse_command(command, duration_s)
        return {
            "status": "success",
            "action": "move",
            "distance": distance,
            "heading": heading,
            "duration_s": duration_s,
        }

    async def run_direction(self, direction):
        command_map = {
            "forward": self.command_forward,
            "backward": self.command_backward,
            "left": self.command_turn_left,
            "right": self.command_turn_right,
        }
        direction_key = str(direction or "").strip().lower()
        command = command_map.get(direction_key)
        if not command:
            raise ValueError(f"Unknown MechDog run direction '{direction}'")

        await self.write_command(command)
        return {
            "status": "success",
            "action": "run",
            "direction": direction_key,
            "requires_stop": True,
        }

    async def turn_left(self, degrees):
        degrees = float(degrees)
        # Degree-based turning is not confirmed by the original Hiwonder code.
        # This starts the left arc turn and leaves timing to wait seconds + stop.
        await self.write_command(self.command_turn_left)
        return {
            "status": "success",
            "action": "turn_left",
            "degrees": degrees,
            "requires_stop": True,
        }

    async def turn_right(self, degrees):
        degrees = float(degrees)
        # Degree-based turning is not confirmed by the original Hiwonder code.
        # This starts the right arc turn and leaves timing to wait seconds + stop.
        await self.write_command(self.command_turn_right)
        return {
            "status": "success",
            "action": "turn_right",
            "degrees": degrees,
            "requires_stop": True,
        }

    async def drive(self, speed, steering):
        speed = max(-self.drive_speed_limit, min(self.drive_speed_limit, float(speed)))
        steering = max(-self.drive_steering_limit, min(self.drive_steering_limit, float(steering)))

        if speed == 0 and steering == 0:
            await self.stop()
            direction = "stop"
        elif speed < 0:
            # The available BLE command set has a backward command, but no confirmed
            # backward steering arc. Negative speed therefore means backward.
            await self.write_command(self.command_backward)
            direction = "backward"
        elif steering < 0:
            await self.write_command(self.command_turn_left)
            direction = "left"
        elif steering > 0:
            await self.write_command(self.command_turn_right)
            direction = "right"
        else:
            await self.write_command(self.command_forward)
            direction = "forward"

        return {
            "status": "success",
            "action": "drive",
            "speed": speed,
            "steering": steering,
            "direction": direction,
            "requires_stop": direction != "stop",
            "message": "Mapped to available MechDog run command; precise speed/steering protocol is not confirmed.",
        }

    async def raw_command(self, command):
        await self.write_command(command)
        return {"status": "success", "action": "raw_command", "command": command}

    async def stop(self):
        for attempt in range(2):
            await self.write_command(self.command_stop)
            if attempt == 0:
                await asyncio.sleep(0.05)
        return {"status": "success", "action": "stop"}

    async def run_action(self, action_name):
        action_key = str(action_name).strip().lower()
        command = self.action_commands.get(action_key)
        if not command:
            raise ValueError(f"Unknown MechDog action '{action_name}'")
        await self.write_command(command)
        return {"status": "success", "action": "mechdog_action", "type": action_key}

    async def get_battery(self):
        payload = await self.query_command(self.command_battery, lambda value: value.startswith("CMD|6|"))
        parts = payload.split("|")
        battery_raw = int(parts[2])
        battery_percent = self._set_battery_raw(battery_raw)
        return {
            "status": "success",
            "action": "battery",
            "battery": battery_percent,
            "battery_percent": battery_percent,
            "battery_raw": battery_raw,
            "battery_level": battery_percent,
        }

    async def get_sonar_distance(self):
        payload = await self.query_command(self.command_sonar, lambda value: value.startswith("CMD|4|"))
        parts = payload.split("|")
        distance = int(parts[2])
        self.last_sonar_distance = distance
        return {"status": "success", "action": "sonar", "distance_mm": distance}

    def get_status(self):
        return {
            "status": "ok",
            "action": "status",
            "robot_connected": bool(self.connected and self.client and self.client.is_connected),
            "device_name": self.device_name,
            "device_address": self.device_address,
            "last_error": self.last_error,
            "battery": self.last_battery_percent,
            "battery_percent": self.last_battery_percent,
            "battery_raw": self.last_battery_raw,
            "battery_level": self.last_battery_percent,
            "sonar_distance_mm": self.last_sonar_distance,
            "timestamp": datetime.now().isoformat(),
        }


controller = MechDogController()


async def try_connect_robot_once():
    try:
        await controller.connect()
    except Exception as exc:
        controller.connected = False
        controller.last_error = str(exc)
        logger.warning("Initial MechDog connection failed: %s", exc)


async def handle_command(websocket, path=None):
    del path
    try:
        welcome_msg = {
            "type": "welcome",
            "message": "MechDog control server",
            "version": "1.0.0",
            "status": controller.get_status(),
        }
        await websocket.send(json.dumps(welcome_msg))

        async for message in websocket:
            try:
                command = json.loads(message)
                action = str(command.get("action", "")).strip().lower()

                if action == "led_on":
                    response = await controller.led_on(command.get("color", "BLUE"))
                elif action == "led_off":
                    response = await controller.led_off()
                elif action == "run":
                    response = await controller.run_direction(command.get("direction", ""))
                elif action == "drive":
                    response = await controller.drive(command.get("speed", 0), command.get("steering", 0))
                elif action == "move":
                    response = await controller.move(command.get("distance", 4), command.get("heading", 0))
                elif action == "turn_left":
                    response = await controller.turn_left(command.get("degrees", 90))
                elif action == "turn_right":
                    response = await controller.turn_right(command.get("degrees", 90))
                elif action == "stop":
                    response = await controller.stop()
                elif action == "mechdog_action":
                    response = await controller.run_action(command.get("type", ""))
                elif action == "battery":
                    response = await controller.get_battery()
                elif action == "sonar":
                    response = await controller.get_sonar_distance()
                elif action in ("status", "get_status"):
                    response = controller.get_status()
                elif action == "reconnect_robot":
                    await controller.reconnect()
                    status = controller.get_status()
                    response = {
                        "status": "ok",
                        "action": "reconnect_robot",
                        "message": "Robot reconnection initiated",
                        "robot_connected": status.get("robot_connected", False),
                        "device_name": status.get("device_name"),
                        "device_address": status.get("device_address"),
                        "last_error": status.get("last_error"),
                        "timestamp": status.get("timestamp"),
                    }
                elif action == "switch_mechdog":
                    await controller.switch_mechdog(command.get("name_match", ""))
                    status = controller.get_status()
                    response = {
                        "status": "success",
                        "action": "switch_mechdog",
                        "message": "MechDog target switched",
                        "robot_connected": status.get("robot_connected", False),
                        "device_name": status.get("device_name"),
                        "device_address": status.get("device_address"),
                        "last_error": status.get("last_error"),
                        "timestamp": status.get("timestamp"),
                    }
                elif action == "disconnect_robot":
                    await controller.disconnect(unpair=command.get("unpair", True))
                    response = {
                        "status": "success",
                        "action": "disconnect_robot",
                        "message": "MechDog disconnected and release requested",
                        "robot_connected": False,
                        "device_name": controller.device_name,
                        "device_address": controller.device_address,
                        "last_error": controller.last_error,
                        "timestamp": datetime.now().isoformat(),
                    }
                elif action == "raw_command":
                    response = await controller.raw_command(command.get("command", ""))
                elif action == "kicker":
                    response = {
                        "status": "error",
                        "action": "kicker",
                        "message": "Kicker actions are not mapped for MechDog in this backend",
                    }
                elif action == "ping":
                    response = {"status": "success", "message": "pong", "timestamp": datetime.now().isoformat()}
                else:
                    response = {"status": "error", "message": f"Unknown action: {action}"}
            except json.JSONDecodeError:
                response = {"status": "error", "message": "Invalid JSON format"}
            except Exception as exc:
                controller.last_error = str(exc)
                response = {"status": "error", "action": action, "message": str(exc)}

            await websocket.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")


async def main():
    port = 8777
    logger.info("Starting MechDog WebSocket server on ws://127.0.0.1:%s", port)
    initial_connect_task = None
    try:
        async with websockets.serve(handle_command, "127.0.0.1", port, ping_interval=None):
            initial_connect_task = asyncio.create_task(try_connect_robot_once())
            await asyncio.Future()
    finally:
        if initial_connect_task:
            initial_connect_task.cancel()
        await controller.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
