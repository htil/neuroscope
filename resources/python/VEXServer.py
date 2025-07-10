import asyncio
import websockets
import json
from vex import *
from vex.vex_globals import *

# Robot initialization for AIM platform
robot = Robot()

# color_list = [
#     RED, GREEN, BLUE, WHITE, YELLOW, ORANGE, PURPLE, CYAN
# ]

# for color in color_list:
#     robot.led.on(ALL_LEDS, color)
#     wait(1, SECONDS)

# robot.led.off(ALL_LEDS)

# Command handler for VEX AIM
# Made 'path' optional so it works with the current websockets API
async def handle_command(websocket, path=None):
    try:
        async for message in websocket:
            command = json.loads(message)
            action = command.get("action", "")
            
            if action == "led_on":
                color_name = command.get("color", "BLUE")
                # Map string color names to vex.Color constants
                color_map = {
                    "RED": RED,
                    "GREEN": GREEN,
                    "BLUE": BLUE,
                    "WHITE": WHITE,
                    "YELLOW": YELLOW,
                    "ORANGE": ORANGE,
                    "PURPLE": PURPLE,
                    "CYAN": CYAN,
                }
                color = color_map.get(color_name.upper(), BLUE)  # Default to BLUE if not found
                print(f"Turning LED on with color: {color_name}")
                robot.led.on(ALL_LEDS, color)
                # Send a response back to the client
                await websocket.send(json.dumps({"status": "success", "action": "led_on", "color": color_name}))
                
            elif action == "move":
                distance_inches = command.get("distance", 4)  # Default to 4 inches instead of 100mm
                heading = command.get("heading", 0)
                # Convert inches to millimeters (1 inch = 25.4 mm)
                distance_mm = distance_inches * 25.4
                print(f"Received move command: {command}")
                print(f"Moving robot: Distance={distance_inches} inches ({distance_mm} mm), Heading={heading}")
                robot.move_for(distance_mm, heading)
                # Send a response back to the client
                await websocket.send(json.dumps({"status": "success", "action": "move", "distance_inches": distance_inches, "distance_mm": distance_mm, "heading": heading}))
                
            elif action == "turn_left":
                degrees = command.get("degrees", 90)
                print(f"Turning robot left: {degrees} degrees")
                robot.turn_for(vex.TurnType.LEFT, degrees)  # Correct VEX method
                # Send a response back to the client
                await websocket.send(json.dumps({"status": "success", "action": "turn_left", "degrees": degrees}))
                
            elif action == "turn_right":
                degrees = command.get("degrees", 90)
                print(f"Turning robot right: {degrees} degrees")
                robot.turn_for(vex.TurnType.RIGHT, degrees)  # Correct VEX method
                # Send a response back to the client
                await websocket.send(json.dumps({"status": "success", "action": "turn_right", "degrees": degrees}))
                
            else:
                print(f"Unknown command: {command}")
                # Send an error response back to the client
                await websocket.send(json.dumps({"status": "error", "message": "Unknown command"}))
    except Exception as e:
        print(f"Error handling command: {e}")
        await websocket.send(json.dumps({"status": "error", "message": str(e)}))

async def main():
    port = 8777
    print(f"Starting WebSocket server on ws://127.0.0.1:{port}")
    async with websockets.serve(handle_command, "127.0.0.1", port):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
