import asyncio
import websockets
import json

# Try to import VEX libraries, but handle gracefully if robot not connected
try:
    from vex import *
    from vex.vex_globals import *
    
    # Try to initialize robot, but catch connection errors
    try:
        robot = Robot()
        VEX_AVAILABLE = True
        print("VEX robot initialized successfully")
    except Exception as e:
        print(f"Warning: Could not connect to VEX robot: {e}")
        print("Running in simulation mode - commands will be logged but not executed")
        robot = None
        VEX_AVAILABLE = False
        
        # Create mock constants for simulation
        RED = "RED"
        GREEN = "GREEN"
        BLUE = "BLUE"
        WHITE = "WHITE"
        YELLOW = "YELLOW"
        ORANGE = "ORANGE"
        PURPLE = "PURPLE"
        CYAN = "CYAN"
        ALL_LEDS = "ALL_LEDS"
        
except ImportError as e:
    print(f"Warning: VEX libraries not available: {e}")
    print("Running in simulation mode - commands will be logged but not executed")
    robot = None
    VEX_AVAILABLE = False
    
    # Create mock constants for simulation
    RED = "RED"
    GREEN = "GREEN"
    BLUE = "BLUE"
    WHITE = "WHITE"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    PURPLE = "PURPLE"
    CYAN = "CYAN"
    ALL_LEDS = "ALL_LEDS"

# color_list = [
#     RED, GREEN, BLUE, WHITE, YELLOW, ORANGE, PURPLE, CYAN
# ]

# for color in color_list:
#     robot.led.on(ALL_LEDS, color)
#     wait(1, SECONDS)

# robot.led.off(ALL_LEDS)

# Command handler for VEX AIM
async def handle_command(websocket, path=None):
    try:
        async for message in websocket:
            command = json.loads(message)
            action = command.get("action", "")
            
            if action == "led_on":
                color_name = command.get("color", "BLUE")
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
                color = color_map.get(color_name.upper(), BLUE)
                print(f"LED Command: Turning on {color_name} LED")
                
                if VEX_AVAILABLE and robot:
                    try:
                        robot.led.on(ALL_LEDS, color)
                        status = "success"
                    except Exception as e:
                        print(f"Error executing LED command: {e}")
                        status = "error"
                else:
                    print("(Simulation mode - no physical robot)")
                    status = "success_simulation"
                
                await websocket.send(json.dumps({"status": status, "action": "led_on", "color": color_name}))
                
            elif action == "move":
                distance_inches = command.get("distance", 4)
                heading = command.get("heading", 0)
                distance_mm = distance_inches * 25.4
                print(f"Move Command: Distance={distance_inches} inches ({distance_mm} mm), Heading={heading}°")
                
                if VEX_AVAILABLE and robot:
                    try:
                        robot.move_for(distance_mm, heading)
                        status = "success"
                    except Exception as e:
                        print(f"Error executing move command: {e}")
                        status = "error"
                else:
                    print("(Simulation mode - no physical robot)")
                    status = "success_simulation"
                
                await websocket.send(json.dumps({
                    "status": status, 
                    "action": "move", 
                    "distance_inches": distance_inches, 
                    "distance_mm": distance_mm, 
                    "heading": heading
                }))
                
            elif action == "turn_left":
                degrees = command.get("degrees", 90)
                print(f"Turn Command: Left {degrees}°")
                
                if VEX_AVAILABLE and robot:
                    try:
                        robot.turn_for(vex.TurnType.LEFT, degrees)
                        status = "success"
                    except Exception as e:
                        print(f"Error executing turn left command: {e}")
                        status = "error"
                else:
                    print("(Simulation mode - no physical robot)")
                    status = "success_simulation"
                
                await websocket.send(json.dumps({"status": status, "action": "turn_left", "degrees": degrees}))
                
            elif action == "turn_right":
                degrees = command.get("degrees", 90)
                print(f"Turn Command: Right {degrees}°")
                
                if VEX_AVAILABLE and robot:
                    try:
                        robot.turn_for(vex.TurnType.RIGHT, degrees)
                        status = "success"
                    except Exception as e:
                        print(f"Error executing turn right command: {e}")
                        status = "error"
                else:
                    print("(Simulation mode - no physical robot)")
                    status = "success_simulation"
                
                await websocket.send(json.dumps({"status": status, "action": "turn_right", "degrees": degrees}))
                
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
