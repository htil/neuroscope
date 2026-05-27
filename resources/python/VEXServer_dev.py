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
        return {"status": "success", "message": "LED turned on", "led_state": True}
        
    def led_off(self):
        """Turn LED off"""
        self.led_state = False
        logger.info("💡 LED turned OFF")
        return {"status": "success", "message": "LED turned off", "led_state": False}
        
    def move(self, distance=10):
        """Move robot forward"""
        self.position["x"] += distance * 0.1  # Simulate movement
        logger.info(f"🚀 Moving robot forward: {distance} units")
        return {"status": "success", "message": f"Moved forward {distance} units", "position": self.position}
        
    def turn_left(self, angle=90):
        """Turn robot left"""
        self.position["heading"] = (self.position["heading"] - angle) % 360
        logger.info(f"🔄 Turning robot left: {angle} degrees")
        return {"status": "success", "message": f"Turned left {angle} degrees", "heading": self.position["heading"]}
        
    def turn_right(self, angle=90):
        """Turn robot right"""
        self.position["heading"] = (self.position["heading"] + angle) % 360
        logger.info(f"🔄 Turning robot right: {angle} degrees")
        return {"status": "success", "message": f"Turned right {angle} degrees", "heading": self.position["heading"]}
        
    def get_status(self):
        """Get robot status"""
        status = {
            "status": "success",
            "connected": self.connected,
            "battery": self.battery_level,
            "position": self.position,
            "led_state": self.led_state,
            "timestamp": datetime.now().isoformat()
        }
        logger.info(f"📊 Status requested: Battery {self.battery_level}%, Position {self.position}")
        return status

class VEXServerDev:
    """Development WebSocket server for VEX robot simulation"""
    
    def __init__(self, host="127.0.0.1", port=8777):
        self.host = host
        self.port = port
        self.robot = MockVEXRobot()
        self.clients = set()
        
    async def handle_client(self, websocket, path):
        """Handle WebSocket client connections"""
        try:
            client_ip = websocket.remote_address[0] if websocket.remote_address else "unknown"
            logger.info(f"🔗 Client connected from {client_ip}")
            self.clients.add(websocket)
            
            # Send welcome message
            welcome_msg = {
                "type": "welcome",
                "message": "VEX Robot Development Server",
                "version": "1.0.0",
                "status": self.robot.get_status()
            }
            await websocket.send(json.dumps(welcome_msg))
            
            async for message in websocket:
                await self.process_message(websocket, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client disconnected")
        except Exception as e:
            logger.error(f"❌ Error handling client: {e}")
        finally:
            self.clients.discard(websocket)
            
    async def process_message(self, websocket, message):
        """Process incoming WebSocket messages"""
        try:
            data = json.loads(message)
            action = data.get("action", "").lower()
            
            logger.info(f"📨 Received command: {action}")
            
            # Handle different VEX commands
            if action == "led_on":
                response = self.robot.led_on()
            elif action == "led_off":
                response = self.robot.led_off()
            elif action == "move":
                distance = data.get("distance", 10)
                response = self.robot.move(distance)
            elif action == "turn_left":
                angle = data.get("angle", 90)
                response = self.robot.turn_left(angle)
            elif action == "turn_right":
                angle = data.get("angle", 90)
                response = self.robot.turn_right(angle)
            elif action == "get_status":
                response = self.robot.get_status()
            elif action == "status":
                # Minimal status for Electron UI badge
                response = {"status": "ok", "action": "status", "robot_connected": bool(self.robot.connected)}
            elif action == "reconnect_robot":
                # Simulate reconnect in mock server
                logger.info("🔄 Mock reconnect robot requested")
                response = {"status": "ok", "action": "reconnect_robot", "message": "Robot reconnection initiated (mock)"}
            elif action == "ping":
                response = {"status": "success", "message": "pong", "timestamp": datetime.now().isoformat()}
                logger.info("🏓 Ping received, sending pong")
            else:
                response = {"status": "error", "message": f"Unknown action: {action}"}
                logger.warning(f"⚠️  Unknown command: {action}")
            
            # Send response back to client
            await websocket.send(json.dumps(response))
            
        except json.JSONDecodeError:
            await self.send_error(websocket, "Invalid JSON format")
        except Exception as e:
            await self.send_error(websocket, f"Error processing message: {str(e)}")
            
    async def send_error(self, websocket, error_message):
        """Send error response to client"""
        error_response = {"status": "error", "message": error_message}
        try:
            await websocket.send(json.dumps(error_response))
            logger.error(f"❌ Sent error to client: {error_message}")
        except Exception as e:
            logger.error(f"❌ Failed to send error message: {e}")
        
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info("🎯 Mock VEX robot ready for commands:")
        logger.info("   • led_on / led_off")
        logger.info("   • move (distance)")
        logger.info("   • turn_left / turn_right (angle)")
        logger.info("   • get_status")
        logger.info("   • ping")
        
        try:
            # Start WebSocket server with proper error handling
            server = await websockets.serve(
                self.handle_client,
                self.host,
                self.port,
                ping_interval=None,  # Disable ping for compatibility
                ping_timeout=None,   # Disable ping timeout
                close_timeout=10,
                max_size=2**20,      # 1MB max message size
                read_limit=2**16,    # 64KB read buffer
                write_limit=2**16    # 64KB write buffer
            )
            
            logger.info(f"✅ Server running! Connect to ws://{self.host}:{self.port}")
            
            # Keep server running forever
            await asyncio.Future()  # Run forever
            
        except Exception as e:
            logger.error(f"❌ Failed to start server: {e}")
            raise

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
        print("\nServer stopped.")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
        print(f"Server error: {e}")

if __name__ == "__main__":
    main()