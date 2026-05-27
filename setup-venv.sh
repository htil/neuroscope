#!/bin/bash

echo "Creating and configuring Python virtual environment..."

# Check if Python is installed
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "Python is not installed. Please run the system setup script first."
    exit 1
fi

# Use python or python3
PYTHON_CMD=$(command -v python || command -v python3)

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating venv..."
    $PYTHON_CMD -m venv venv
else
    echo "venv already exists."
fi

# Activate the venv
echo "Activating virtual environment..."
source venv/Scripts/activate

# Install dependencies
if [ -f "requirements.txt" ]; then
    echo "Installing from requirements.txt..."
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "No requirements.txt found. Installing known dependencies..."
    pip install --upgrade pip
    pip install websocket-client
fi

echo "Setup complete. To activate later, run:"
echo "source venv/Scripts/activate"
