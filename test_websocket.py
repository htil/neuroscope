import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:8777"
    try:
        print(f"Connecting to {uri}...")
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to VEX WebSocket server!")
            
            # Test a simple command
            test_command = {
                "action": "move",
                "distance": 5,
                "heading": 0
            }
            
            print(f"Sending test command: {test_command}")
            await websocket.send(json.dumps(test_command))
            
            response = await websocket.recv()
            print(f"✅ Server response: {response}")
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())