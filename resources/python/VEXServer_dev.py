import asyncio
import websockets
import json

print("Starting VEX WebSocket Server (Development Mode)")
print("VEX libraries not loaded - running in simulation mode")

# Mock VEX constants for simulation
VEX_AVAILABLE = False
RED = "RED"
GREEN = "GREEN"
BLUE = "BLUE"
WHITE = "WHITE"
YELLOW = "YELLOW"
ORANGE = "ORANGE"
PURPLE = "PURPLE"
CYAN = "CYAN"
ALL_LEDS = "ALL_LEDS"

# Command handler for VEX AIM
async def handle_command(websocket, path=None):
    try:
        async for message in websocket:
            command = json.loads(message)
            action = command.get("action", "")
            
            if action == "led_on":
                color_name = command.get("color", "BLUE")
                print(f"LED Command: Turning on {color_name} LED (Simulation)")
                await websocket.send(json.dumps({"status": "success_simulation", "action": "led_on", "color": color_name}))
                
            elif action == "move":
                distance_inches = command.get("distance", 4)
                heading = command.get("heading", 0)
                distance_mm = distance_inches * 25.4
                print(f"Move Command: Distance={distance_inches} inches ({distance_mm} mm), Heading={heading}° (Simulation)")
                
                await websocket.send(json.dumps({
                    "status": "success_simulation", 
                    "action": "move", 
                    "distance_inches": distance_inches, 
                    "distance_mm": distance_mm, 
                    "heading": heading
                }))
                
            elif action == "turn_left":
                degrees = command.get("degrees", 90)
                print(f"Turn Command: Left {degrees}° (Simulation)")
                await websocket.send(json.dumps({"status": "success_simulation", "action": "turn_left", "degrees": degrees}))
                
            elif action == "turn_right":
                degrees = command.get("degrees", 90)
                print(f"Turn Command: Right {degrees}° (Simulation)")
                await websocket.send(json.dumps({"status": "success_simulation", "action": "turn_right", "degrees": degrees}))
                
            else:
                print(f"Unknown command: {command}")
                await websocket.send(json.dumps({"status": "error", "message": "Unknown command"}))
                
    except Exception as e:
        print(f"Error handling command: {e}")
        await websocket.send(json.dumps({"status": "error", "message": str(e)}))

async def main():
    port = 8777
    print(f"Starting WebSocket server on ws://127.0.0.1:{port}")
    print(f"VEX robot available: {VEX_AVAILABLE}")
    
    async with websockets.serve(handle_command, "127.0.0.1", port):
        print("WebSocket server is ready and listening...")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer shutting down...")
    except Exception as e:
        print(f"Server error: {e}")