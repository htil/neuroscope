// Simple test to verify WebSocket reconnection works
const WebSocket = require('ws');

let ws = null;

function createWebSocketConnection() {
    return new Promise((resolve, reject) => {
        try {
            ws = new WebSocket('ws://127.0.0.1:8777');

            ws.on('open', function open() {
                console.log('WebSocket connection opened');
                resolve();
            });

            ws.on('error', function error(err) {
                console.error('WebSocket error:', err.message);
                reject(err);
            });

            ws.on('close', function close() {
                console.log('WebSocket connection closed');
            });

            // Set a timeout in case connection takes too long
            setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 5000);
        } catch (error) {
            reject(error);
        }
    });
}

async function testReconnect() {
    console.log('Testing WebSocket reconnection...');

    try {
        // Test initial connection
        console.log('1. Creating initial connection...');
        await createWebSocketConnection();
        console.log('✓ Initial connection successful');

        // Test reconnection
        console.log('2. Testing reconnection...');
        if (ws) {
            ws.close();
            ws = null;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        await createWebSocketConnection();
        console.log('✓ Reconnection successful');

        if (ws) {
            ws.close();
        }

        console.log('✓ All tests passed!');
    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
}

testReconnect();