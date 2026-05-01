import asyncio
import websockets
import json

async def send_test_commands():
    uri = "ws://localhost:8765"  # WebSocket server address
    try:
        print(f"Connecting to WebSocket server at {uri}...")
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket server!")

            # Test 1: Turn LED on with a specific color
            led_command = {
                "action": "led_on",
                "color": "GREEN"  # Change to any color: "RED", "BLUE", etc.
            }
            print(f"Sending LED command: {led_command}")
            await websocket.send(json.dumps(led_command))
            response = await websocket.recv()
            print(f"Response from server: {response}")

            # Test 2: Move the robot forward
            move_command = {
                "action": "move",
                "distance": 100,  # Distance in cm
                "heading": 0      # Heading in degrees
            }
            print(f"Sending move command: {move_command}")
            await websocket.send(json.dumps(move_command))
            response = await websocket.recv()
            print(f"Response from server: {response}")

            # Test 3: Turn LED off
            led_off_command = {
                "action": "led_on",
                "color": "OFF"  # Assuming "OFF" turns off the LEDs
            }
            print(f"Sending LED off command: {led_off_command}")
            await websocket.send(json.dumps(led_off_command))
            response = await websocket.recv()
            print(f"Response from server: {response}")

    except Exception as e:
        print(f"Error: {e}")

def main():
    asyncio.run(send_test_commands())

if __name__ == "__main__":
    main()