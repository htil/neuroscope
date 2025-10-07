#!/usr/bin/env python3
"""
VEXServer Development Simulation
Mock VEX robot server for development and testing without hardware.
Provides WebSocket interface compatible with production VEXServer.py
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MockVEXRobot:
    """Mock VEX robot for simulation"""
    
    def __init__(self):
        self.position = {"x": 0, "y": 0, "heading": 0}
        self.led_state = False
        self.battery_level = 85
        self.connected = True
        
    def led_on(self):
        """Turn LED on"""
        self.led_state = True
        logger.info("🔆 LED turned ON")
        return {"status": "success", "led": "on"}
        
    def led_off(self):
        """Turn LED off"""
        self.led_state = False
        logger.info("🔅 LED turned OFF")
        return {"status": "success", "led": "off"}
        
    def move(self, distance=10):
        """Move robot forward"""
        # Simulate movement based on current heading
        import math
        self.position["x"] += distance * math.cos(math.radians(self.position["heading"]))
        self.position["y"] += distance * math.sin(math.radians(self.position["heading"]))
        
        logger.info(f"🤖 Moved {distance}cm forward to position ({self.position['x']:.1f}, {self.position['y']:.1f})")
        return {
            "status": "success", 
            "action": "move", 
            "distance": distance,
            "position": self.position.copy()
        }
        
    def turn_left(self, angle=90):
        """Turn robot left"""
        self.position["heading"] = (self.position["heading"] + angle) % 360
        logger.info(f"↺ Turned left {angle}° (now facing {self.position['heading']}°)")
        return {
            "status": "success", 
            "action": "turn_left", 
            "angle": angle,
            "heading": self.position["heading"]
        }
        
    def turn_right(self, angle=90):
        """Turn robot right"""
        self.position["heading"] = (self.position["heading"] - angle) % 360
        logger.info(f"↻ Turned right {angle}° (now facing {self.position['heading']}°)")
        return {
            "status": "success", 
            "action": "turn_right", 
            "angle": angle,
            "heading": self.position["heading"]
        }
        
    def get_status(self):
        """Get robot status"""
        return {
            "connected": self.connected,
            "battery": self.battery_level,
            "led": "on" if self.led_state else "off",
            "position": self.position.copy(),
            "timestamp": datetime.now().isoformat()
        }

class VEXServerDev:
    """Development WebSocket server for VEX robot simulation"""
    
    def __init__(self, host="127.0.0.1", port=8777):
        self.host = host
        self.port = port
        self.robot = MockVEXRobot()
        self.clients = set()
        
    async def handle_client(self, websocket, path):
        """Handle WebSocket client connection"""
        self.clients.add(websocket)
        client_addr = websocket.remote_address
        logger.info(f"🔗 Client connected from {client_addr}")
        
        try:
            # Send welcome message
            welcome_msg = {
                "type": "welcome",
                "message": "VEX Robot Development Server",
                "version": "1.0.0",
                "status": self.robot.get_status()
            }
            await websocket.send(json.dumps(welcome_msg))
            
            async for message in websocket:
                try:
                    await self.process_message(websocket, message)
                except json.JSONDecodeError:
                    await self.send_error(websocket, "Invalid JSON format")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    await self.send_error(websocket, str(e))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client {client_addr} disconnected")
        except Exception as e:
            logger.error(f"Connection error with {client_addr}: {e}")
        finally:
            self.clients.discard(websocket)
            
    async def process_message(self, websocket, message):
        """Process incoming WebSocket message"""
        try:
            data = json.loads(message)
            command = data.get("command", "").lower()
            params = data.get("params", {})
            
            logger.info(f"📨 Received command: {command} with params: {params}")
            
            # Execute command
            if command == "led_on":
                result = self.robot.led_on()
            elif command == "led_off":
                result = self.robot.led_off()
            elif command == "move":
                distance = params.get("distance", 10)
                result = self.robot.move(distance)
            elif command == "turn_left":
                angle = params.get("angle", 90)
                result = self.robot.turn_left(angle)
            elif command == "turn_right":
                angle = params.get("angle", 90)
                result = self.robot.turn_right(angle)
            elif command == "get_status":
                result = self.robot.get_status()
            elif command == "ping":
                result = {"status": "pong", "timestamp": datetime.now().isoformat()}
            else:
                result = {"status": "error", "message": f"Unknown command: {command}"}
                
            # Send response
            response = {
                "id": data.get("id"),
                "command": command,
                "result": result,
                "timestamp": datetime.now().isoformat()
            }
            
            await websocket.send(json.dumps(response))
            
        except Exception as e:
            await self.send_error(websocket, f"Command execution error: {str(e)}")
            
    async def send_error(self, websocket, error_message):
        """Send error response to client"""
        error_response = {
            "status": "error",
            "message": error_message,
            "timestamp": datetime.now().isoformat()
        }
        await websocket.send(json.dumps(error_response))
        
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"🚀 Starting VEX Development Server on ws://{self.host}:{self.port}")
        logger.info("🎯 Mock VEX robot ready for commands:")
        logger.info("   • led_on / led_off")
        logger.info("   • move (distance)")
        logger.info("   • turn_left / turn_right (angle)")
        logger.info("   • get_status")
        logger.info("   • ping")
        
        async with websockets.serve(self.handle_client, self.host, self.port):
            logger.info(f"✅ Server running! Connect to ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever

def main():
    """Main entry point"""
    print("Welcome to the VEX Development Server")
    print("====================================")
    print("This is a mock server for development and testing.")
    print("No physical VEX robot hardware is required.")
    print("")
    
    server = VEXServerDev()
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")

if __name__ == "__main__":
    main()