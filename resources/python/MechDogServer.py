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
        self.pair = os.getenv("MECHDOG_PAIR", "0").strip().lower() not in ("0", "false", "no")

        self.command_stop = "CMD|3|0|$"
        self.command_forward = os.getenv("MECHDOG_CMD_FORWARD", "CMD|3|3|$")
        self.command_turn_right = os.getenv("MECHDOG_CMD_TURN_RIGHT", "CMD|3|1|$")
        self.command_turn_left = os.getenv("MECHDOG_CMD_TURN_LEFT", "CMD|3|5|$")
        self.command_backward = os.getenv("MECHDOG_CMD_BACKWARD", "").strip() or None

        self.move_seconds_per_unit = float(os.getenv("MECHDOG_MOVE_SECONDS_PER_UNIT", "0.15"))
        self.turn_seconds_per_90 = float(os.getenv("MECHDOG_TURN_SECONDS_PER_90", "0.7"))

        self.client = None
        self.connected = False
        self.device_name = None
        self.last_error = None
        self._connect_lock = asyncio.Lock()
        self._motion_lock = asyncio.Lock()

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
        logger.warning("MechDog BLE connection closed")

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

    def get_status(self):
        return {
            "status": "ok",
            "action": "status",
            "robot_connected": bool(self.connected and self.client and self.client.is_connected),
            "device_name": self.device_name,
            "device_address": self.device_address,
            "last_error": self.last_error,
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
                elif action == "move":
                    response = await controller.move(command.get("distance", 4), command.get("heading", 0))
                elif action == "turn_left":
                    response = await controller.turn_left(command.get("degrees", 90))
                elif action == "turn_right":
                    response = await controller.turn_right(command.get("degrees", 90))
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
                response = {"status": "error", "message": str(exc)}

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
