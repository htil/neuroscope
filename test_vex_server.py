#!/usr/bin/env python3
"""
Simple test script to verify VEX Development Server is working
"""
import asyncio
import websockets
import json

async def test_vex_server():
    """Test the VEX development server"""
    uri = "ws://127.0.0.1:8777"
    
    try:
        print(f"🔌 Connecting to {uri}...")
        async with websockets.connect(uri) as websocket:
            print("✅ Connected successfully!")
            
            # Wait for welcome message
            welcome = await websocket.recv()
            print(f"📩 Welcome: {welcome}")
            
            # Test LED command
            led_command = {"action": "led_on", "color": "GREEN"}
            print(f"📤 Sending: {led_command}")
            await websocket.send(json.dumps(led_command))
            
            response = await websocket.recv()
            print(f"📥 Response: {response}")
            
            # Test move command
            move_command = {"action": "move", "distance": 50}
            print(f"📤 Sending: {move_command}")
            await websocket.send(json.dumps(move_command))
            
            response = await websocket.recv()
            print(f"📥 Response: {response}")
            
            # Test status command
            status_command = {"action": "get_status"}
            print(f"📤 Sending: {status_command}")
            await websocket.send(json.dumps(status_command))
            
            response = await websocket.recv()
            print(f"📥 Response: {response}")
            
            print("✅ All tests passed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_vex_server())