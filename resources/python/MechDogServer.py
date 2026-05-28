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
        self.device_address = os.getenv("MECHDOG_ADDRESS", "").strip()
        self.write_uuid = os.getenv("MECHDOG_WRITE_UUID", "0000ffe1-0000-1000-8000-00805f9b34fb")
        self.notify_uuid = os.getenv("MECHDOG_NOTIFY_UUID", "0000ffe2-0000-1000-8000-00805f9b34fb")
        self.pair = os.getenv("MECHDOG_PAIR", "0").strip().lower() not in ("0", "false", "no")

        self.command_stop = "CMD|3|0|$"
        self.command_forward = os.getenv("MECHDOG_CMD_FORWARD", "CMD|3|3|$")
        self.command_turn_right = os.getenv("MECHDOG_CMD_TURN_RIGHT", "CMD|3|1|$")
        self.command_turn_left = os.getenv("MECHDOG_CMD_TURN_LEFT", "CMD|3|5|$")
        self.command_backward = os.getenv("MECHDOG_CMD_BACKWARD", "CMD|3|7|$")
        self.command_handshake = os.getenv("MECHDOG_CMD_HANDSHAKE", "CMD|2|1|7|$")
        self.command_boxing = os.getenv("MECHDOG_CMD_BOXING", "CMD|2|1|10|$")
        self.command_battery = os.getenv("MECHDOG_CMD_BATTERY", "CMD|6|$")
        self.command_sonar = os.getenv("MECHDOG_CMD_SONAR", "CMD|4|1|$")

        self.move_seconds_per_unit = float(os.getenv("MECHDOG_MOVE_SECONDS_PER_UNIT", "0.15"))
        self.turn_seconds_per_90 = float(os.getenv("MECHDOG_TURN_SECONDS_PER_90", "0.7"))
        self.response_timeout_seconds = float(os.getenv("MECHDOG_RESPONSE_TIMEOUT_SECONDS", "3"))

        self.client = None
        self.connected = False
        self.device_name = None
        self.last_error = None
        self.last_battery = None
        self.last_sonar_distance = None
        self._notify_started = False
        self._response_queue = asyncio.Queue()
        self._connect_lock = asyncio.Lock()
        self._motion_lock = asyncio.Lock()

    async def scan_devices(self, timeout=6.0):
        logger.info("Scanning for nearby MechDogs for %.1f seconds...", timeout)
        devices = await BleakScanner.discover(timeout=float(timeout))
        results = []
        for device in devices:
            if not device.name or not device.name.lower().startswith(self.device_name_prefix):
                continue
            results.append(
                {
                    "name": device.name,
                    "address": device.address,
                    "rssi": getattr(device, "rssi", None),
                }
            )

        results.sort(key=lambda item: ((item.get("name") or ""), (item.get("address") or "")))
        return results

    async def select_device(self, address, name=None):
        selected_address = str(address or "").strip()
        if not selected_address:
            raise ValueError("A MechDog Bluetooth address is required")

        should_disconnect = (
            self.client is not None
            and self.client.is_connected
            and self.device_address
            and self.device_address.lower() != selected_address.lower()
        )
        if should_disconnect:
            await self.disconnect()

        self.device_address = selected_address
        self.device_name = str(name or self.device_name or "").strip() or None
        self.last_error = None

        return {
            "status": "success",
            "action": "select_device",
            "device_name": self.device_name,
            "device_address": self.device_address,
            "robot_connected": bool(self.connected and self.client and self.client.is_connected),
        }

    async def _find_device(self):
        if self.device_address:
            logger.info("Using configured MechDog address: %s", self.device_address)
            return self.device_address

        logger.info("Scanning for MechDog with prefix '%s'...", self.device_name_prefix)
        devices = await BleakScanner.discover(timeout=8.0)
        for device in devices:
            if device.name and device.name.lower().startswith(self.device_name_prefix):
                self.device_name = device.name
                self.device_address = device.address
                logger.info("Found MechDog: %s (%s)", device.name, device.address)
                return device
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
                    self.last_battery = int(parts[2])
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
            await client.connect()

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

    async def disconnect(self):
        async with self._connect_lock:
            if self.client is not None:
                client = self.client
                try:
                    if client.is_connected:
                        await client.disconnect()
                except Exception as exc:
                    logger.warning("Error disconnecting MechDog: %s", exc)
                finally:
                    self.client = None
                    self.connected = False

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
        await self.disconnect()
        await asyncio.sleep(1.0)
        await self.connect()

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
            await self.write_command(command)
            await asyncio.sleep(max(0.1, duration_s))
            await self.write_command(self.command_stop)

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

    async def turn_left(self, degrees):
        degrees = float(degrees)
        duration_s = min(2.5, max(0.2, (abs(degrees) / 90.0) * self.turn_seconds_per_90))
        await self.pulse_command(self.command_turn_left, duration_s)
        return {
            "status": "success",
            "action": "turn_left",
            "degrees": degrees,
            "duration_s": duration_s,
        }

    async def turn_right(self, degrees):
        degrees = float(degrees)
        duration_s = min(2.5, max(0.2, (abs(degrees) / 90.0) * self.turn_seconds_per_90))
        await self.pulse_command(self.command_turn_right, duration_s)
        return {
            "status": "success",
            "action": "turn_right",
            "degrees": degrees,
            "duration_s": duration_s,
        }

    async def raw_command(self, command):
        await self.write_command(command)
        return {"status": "success", "action": "raw_command", "command": command}

    async def stop(self):
        await self.write_command(self.command_stop)
        return {"status": "success", "action": "stop"}

    async def run_action(self, action_name):
        action_map = {
            "handshake": self.command_handshake,
            "boxing": self.command_boxing,
        }
        command = action_map.get(str(action_name).strip().lower())
        if not command:
            raise ValueError(f"Unknown MechDog action '{action_name}'")
        await self.write_command(command)
        return {"status": "success", "action": "mechdog_action", "type": action_name}

    async def get_battery(self):
        payload = await self.query_command(self.command_battery, lambda value: value.startswith("CMD|6|"))
        parts = payload.split("|")
        battery = int(parts[2])
        self.last_battery = battery
        return {"status": "success", "action": "battery", "battery": battery}

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
            "battery": self.last_battery,
            "sonar_distance_mm": self.last_sonar_distance,
            "timestamp": datetime.now().isoformat(),
        }


controller = MechDogController()


async def try_connect_robot_once():
    if not controller.device_address:
        logger.info("No MechDog selected yet; waiting for an explicit device choice")
        return
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
                elif action == "scan_devices":
                    response = {
                        "status": "success",
                        "action": "scan_devices",
                        "devices": await controller.scan_devices(command.get("timeout", 6.0)),
                    }
                elif action == "select_device":
                    response = await controller.select_device(
                        command.get("address", ""),
                        command.get("name"),
                    )
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
                elif action == "raw_command":
                    response = await controller.raw_command(command.get("command", ""))
                elif action == "ping":
                    response = {"status": "success", "message": "pong", "timestamp": datetime.now().isoformat()}
                else:
                    response = {"status": "error", "message": f"Unknown action: {action}"}
            except json.JSONDecodeError:
                response = {"status": "error", "message": "Invalid JSON format"}
            except Exception as exc:
                controller.last_error = str(exc)
                response = {"status": "error", "message": str(exc)}

            request_id = command.get("request_id") if isinstance(command, dict) else None
            if request_id is not None and isinstance(response, dict):
                response["request_id"] = request_id

            await websocket.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")


async def main():
    port = 8777
    logger.info("Starting MechDog WebSocket server on ws://127.0.0.1:%s", port)
    await try_connect_robot_once()
    try:
        async with websockets.serve(handle_command, "127.0.0.1", port, ping_interval=None):
            await asyncio.Future()
    finally:
        await controller.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
