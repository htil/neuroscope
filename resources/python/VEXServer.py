import asyncio
import websockets
import json
from vex import *
from vex.vex_globals import *

# Defer robot initialization to runtime to avoid exiting when AIM is not reachable
robot = None
robot_connecting = False

def robot_is_connected():
    if robot is None:
        return False
    try:
        status_thread = robot._ws_status_thread
        command_thread = robot._ws_cmd_thread
        return (
            bool(status_thread.ws.connected)
            and bool(command_thread.ws.connected)
            and not status_thread.is_current_status_empty()
        )
    except Exception:
        return False

async def try_connect_robot():
    global robot, robot_connecting
    while True:
        if robot is None and not robot_connecting:
            robot_connecting = True
            try:
                print("Attempting to connect to AIM robot at 192.168.4.1...")
                robot = await asyncio.to_thread(Robot)
                print("AIM robot connected successfully.")
            except SystemExit:
                # aim.py may call sys.exit on failure; swallow and retry later
                robot = None
                print("AIM robot not reachable; will retry in 5s.")
                await asyncio.sleep(5)
            except Exception as e:
                robot = None
                print(f"Unexpected error connecting to AIM: {e}")
                await asyncio.sleep(5)
            finally:
                robot_connecting = False
        elif robot is not None and not robot_is_connected():
            print("AIM robot connection lost; preparing to reconnect.")
            await asyncio.to_thread(disconnect_robot)
        await asyncio.sleep(1)

def disconnect_robot():
    """Properly disconnect and clean up the robot connection"""
    global robot
    if robot is not None:
        try:
            print("Disconnecting robot - closing all WebSocket connections...")
            # Close the actual WebSocket connections first
            try:
                if hasattr(robot, '_ws_cmd_thread') and robot._ws_cmd_thread.ws:
                    robot._ws_cmd_thread.ws.close()
            except:
                pass
            try:
                if hasattr(robot, '_ws_status_thread') and robot._ws_status_thread.ws:
                    robot._ws_status_thread.ws.close()
            except:
                pass
            try:
                if hasattr(robot, '_ws_img_thread') and robot._ws_img_thread.ws:
                    robot._ws_img_thread.ws.close()
            except:
                pass
            try:
                if hasattr(robot, '_ws_audio_thread') and robot._ws_audio_thread.ws:
                    robot._ws_audio_thread.ws.close()
            except:
                pass
            
            # Then stop the threads
            try:
                robot._ws_cmd_thread.running = False
            except:
                pass
            try:
                robot._ws_status_thread.running = False
            except:
                pass
            try:
                robot._ws_img_thread.running = False
            except:
                pass
            try:
                robot._ws_audio_thread.running = False
            except:
                pass
            try:
                robot._ws_img_thread.stop_stream()
            except:
                pass
            
            # Give threads a moment to clean up
            import time
            time.sleep(0.3)
            
        except Exception as e:
            print(f"Error during robot disconnect: {e}")
        finally:
            robot = None
            print("Robot disconnected and ready for reconnection.")

def ensure_robot():
    if not robot_is_connected():
        raise Exception("Robot not connected")

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
    global robot  # Declare at function start
    try:
        async for message in websocket:
            command = json.loads(message)
            action = command.get("action", "")
            
            # Handle commands that require robot connection
            if action in ("led_on", "move", "turn_left", "turn_right", "kicker"):
                try:
                    ensure_robot()
                except Exception as e:
                    await websocket.send(json.dumps({"status": "error", "message": str(e)}))
                    continue
            
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
            
            elif action == "status":
                await websocket.send(json.dumps({
                    "status": "ok",
                    "action": "status",
                    "robot_connected": robot_is_connected()
                }))
            
            elif action == "reconnect_robot":
                # Force an immediate reconnection attempt to the robot
                print("Reconnect robot requested - closing existing connection and reconnecting...")
                disconnect_robot()  # Properly close old connection
                await websocket.send(json.dumps({
                    "status": "ok",
                    "action": "reconnect_robot",
                    "message": "Robot reconnection initiated"
                }))
                
            elif action == "kicker":
                # Accepts types: 'hard', 'soft', 'medium', or 'place'
                ktype = str(command.get("type", "")).strip().lower()
                print(f"Kicker command received: type={ktype}")
                try:
                    if ktype == "place":
                        # Place gently in front of robot (proxy to SOFT kick)
                        robot.kicker.place()
                        await websocket.send(json.dumps({"status": "success", "action": "kicker", "type": "place"}))
                    else:
                        # Map friendly strings to KickType enum
                        # Also accept raw values from vex_types (e.g., 'kick_soft')
                        mapping = {
                            "soft": KickType.SOFT,
                            "medium": KickType.MEDIUM,
                            "hard": KickType.HARD,
                            "kick_soft": KickType.SOFT,
                            "kick_medium": KickType.MEDIUM,
                            "kick_hard": KickType.HARD,
                        }
                        kt = mapping.get(ktype)
                        if kt is None:
                            raise ValueError(f"Unknown kicker type '{ktype}'")
                        robot.kicker.kick(kt)
                        await websocket.send(json.dumps({"status": "success", "action": "kicker", "type": ktype}))
                except Exception as ex:
                    print(f"Error executing kicker: {ex}")
                    await websocket.send(json.dumps({"status": "error", "action": "kicker", "message": str(ex)}))
                
            else:
                print(f"Unknown command: {command}")
                # Send an error response back to the client
                await websocket.send(json.dumps({"status": "error", "message": "Unknown command"}))
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    except Exception as e:
        print(f"Error handling command: {e}")
        try:
            await websocket.send(json.dumps({"status": "error", "message": str(e)}))
        except:
            pass  # Connection may already be closed

async def main():
    port = 8777
    print(f"Starting WebSocket server on ws://127.0.0.1:{port}")
    # Start background task to try connecting to the robot continuously
    connect_task = asyncio.create_task(try_connect_robot())
    async with websockets.serve(handle_command, "127.0.0.1", port, ping_interval=None):
        await asyncio.Future()  # run forever
    connect_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())
