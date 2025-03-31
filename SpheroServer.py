import asyncio
import websockets
import json
from spherov2 import scanner
from spherov2.sphero_edu import SpheroEduAPI
from spherov2.types import Color

# Function to find the Sphero BOLT synchronously
async def find_toy():
    try:
        print("Scanning for Sphero BOLT...")
        # Wrapping the synchronous `find_toy` method in a coroutine
        loop = asyncio.get_event_loop()
        toy = await loop.run_in_executor(None, scanner.find_toy)
        if not toy:
            print("No Sphero BOLT found.")
            return None
        print("Sphero BOLT found!")
        return toy
    except Exception as e:
        print(f"Error during toy scanning: {e}")
        return None

# Command handler for Sphero
async def handle_command(droid, command):
    try:
        if command["action"] == "led_on":
            color = command.get("color", {"r": 0, "g": 255, "b": 0})  # Default green
            print(f"Turning LED on with color: {color}")
            droid.set_main_led(Color(r=color["r"], g=color["g"], b=color["b"]))
        elif command["action"] == "led_off":
            print("Turning LED off")
            droid.set_main_led(Color(r=0, g=0, b=0))  # Turn off LED
        elif command["action"] == "move":
            print("Moving Sphero BOLT")
            heading = command.get("heading", 0)  # Default to up
            speed = command.get("speed", 60)
            duration = command.get("duration", 2)
            droid.roll(heading, speed, duration)
        else:
            print(f"Unknown command: {command}")
    except Exception as e:
        print(f"Error handling command {command}: {e}")
        raise e  # Propagate the exception for better debugging

async def handle_connection(websocket):
    print("Client connected")
    toy = await find_toy()  # Find the Sphero BOLT asynchronously
    if not toy:
        print("Sphero BOLT not found!")
        await websocket.send(json.dumps({"error": "Sphero BOLT not found!"}))
        return

    with SpheroEduAPI(toy) as droid:
        droid.set_main_led(Color(r=0, g=0, b=255))  # Set LED to blue for idle
        try:
            async for message in websocket:
                print(f"Received message: {message}")
                try:
                    command = json.loads(message)
                    await handle_command(droid, command)
                except json.JSONDecodeError:
                    print(f"Invalid JSON received: {message}")
                    await websocket.send(json.dumps({"error": "Invalid JSON format"}))
        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected")
        except Exception as e:
            print(f"Unexpected server error: {e}")

async def main():
    print("Starting WebSocket server on ws://localhost:8765")
    async with websockets.serve(handle_connection, "localhost", 8765):
        await asyncio.Future()  # Keep the server running indefinitely

if __name__ == "__main__":
    asyncio.run(main())
