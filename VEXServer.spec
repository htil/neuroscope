# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Get the current directory (where the .spec file is located)
# SPECPATH might resolve incorrectly, so we use the actual working directory
spec_root = os.getcwd()
print(f'[PYINSTALLER] Working directory (spec_root): {spec_root}')

# Add the resources/python directory to the path
sys.path.insert(0, os.path.join(spec_root, 'resources', 'python'))

# Collect all submodules and data files for websockets and related packages
hiddenimports = []
hiddenimports += collect_submodules('websockets')
hiddenimports += collect_submodules('websocket')
hiddenimports += collect_submodules('bleak')
hiddenimports += collect_submodules('ssl')
hiddenimports += collect_submodules('asyncio')
hiddenimports += collect_submodules('vex')

# Collect data files
datas = []
datas += collect_data_files('websockets')

# Include the vex module folder with settings.json and all Python files
# Use os.path.abspath to ensure we get the correct path relative to the spec file
vex_source = os.path.join(spec_root, 'resources', 'python', 'vex')
if os.path.exists(vex_source):
    datas.append((vex_source, 'vex'))
    print(f'[PYINSTALLER] Including vex module from: {vex_source}')
else:
    print(f'[PYINSTALLER] WARNING: vex module not found at: {vex_source}')

a = Analysis(
    ['resources/python/MechDogServer.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MechDogServer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
