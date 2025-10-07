# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Get the current directory (where the .spec file is located)
spec_root = os.path.dirname(os.path.abspath(SPECPATH))

# Add the resources/python directory to the path
sys.path.insert(0, os.path.join(spec_root, 'resources', 'python'))

# Collect all submodules and data files for websockets and related packages
hiddenimports = []
hiddenimports += collect_submodules('websockets')
hiddenimports += collect_submodules('websocket')
hiddenimports += collect_submodules('ssl')
hiddenimports += collect_submodules('asyncio')

# Collect data files
datas = []
datas += collect_data_files('websockets')

a = Analysis(
    ['resources/python/VEXServer.py'],
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
    name='VEXServer',
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