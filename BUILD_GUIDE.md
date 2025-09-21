# NeuroBlock Build Guide

This guide explains how to build NeuroBlock as a Windows executable with an integrated Python server.

## Build System Overview

NeuroBlock now supports building as a standalone Windows executable that includes:
1. **Electron App**: The main GUI application
2. **Python Server**: A WebSocket server that controls the VEX robot

## Prerequisites

1. **Node.js and Yarn**: For building the Electron application
2. **Python 3.10+**: For building the Python server executable
3. **Git**: For version control

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
yarn install

# Configure Python environment (creates virtual environment)
# This will be done automatically when you run the build scripts
```

### 2. Build Everything

```bash
# Build both Python executable and Electron app
yarn build:all
```

This command will:
1. Create a Python virtual environment
2. Install Python dependencies
3. Build a standalone Python executable (`VEXServer.exe`)
4. Build the Vue.js renderer
5. Package everything into a Windows installer

## Individual Build Commands

### Python Server Only
```bash
yarn build:python
```
Creates: `dist/python/VEXServer.exe`

### Vue.js Renderer Only
```bash
yarn build
```
Creates: `build/renderer/` directory with compiled assets

### Windows Executable Only
```bash
yarn build:win
```
Creates: `dist/NeuroBlock Setup 1.3.0.exe`

## Development Mode

```bash
yarn serve
```

This starts:
- Development server for the renderer on `http://localhost:3000`
- Python WebSocket server on `ws://127.0.0.1:8777`
- Electron main process with hot reload

## Build Output

After running `yarn build:all`, you'll find:

- **`dist/NeuroBlock Setup 1.3.0.exe`**: Windows installer
- **`dist/python/VEXServer.exe`**: Standalone Python server
- **`build/renderer/`**: Compiled web assets

## Production Path Fix

The main issue that was resolved:
- **Before**: Main process tried to load from `../renderer/index.html`
- **After**: Main process loads from `../../build/renderer/index.html`
- **Method**: Changed from `win.loadURL()` to `win.loadFile()` for better path resolution

## Python Server Integration

The Python server is automatically started by the Electron main process:

- **Development**: Uses `python` command with source files
- **Production**: Uses bundled `VEXServer.exe` executable
- **Communication**: WebSocket on port 8777
- **Fallback**: If bundled executable not found, falls back to system Python

## Architecture

```
NeuroBlock.exe (Electron Main Process)
├── Renderer Process (Vue.js UI)
└── Python Server (VEXServer.exe)
    └── WebSocket Server (port 8777)
        └── VEX Robot Control
```

## Troubleshooting

### White Screen Issue
If you see a white screen, the renderer path is incorrect. This has been fixed by updating the main process to use the correct build directory.

### Python Server Not Starting
1. Check if Python is installed
2. Ensure all Python dependencies are installed
3. Check console for Python error messages
4. Verify port 8777 is not in use

### Build Failures
1. Run `yarn install` to ensure all dependencies are installed
2. Check that Python virtual environment is properly configured
3. Ensure sufficient disk space for build process

## File Structure

```
neuroscope/
├── src/main/index.js          # Electron main process (updated)
├── package.json               # Build configuration (updated)
├── VEXServer.spec            # PyInstaller specification (new)
├── requirements.txt          # Python dependencies (updated)
├── dist/                     # Build output
│   ├── NeuroBlock Setup 1.3.0.exe
│   └── python/VEXServer.exe
└── build/renderer/           # Compiled web assets
```

## Key Changes Made

1. **Fixed production build path** in `src/main/index.js`
2. **Added Python executable support** with fallback to source files
3. **Updated electron-builder configuration** to include build directory
4. **Created PyInstaller spec file** for better Python build control
5. **Added comprehensive build scripts** for different scenarios
6. **Improved error handling** and process cleanup