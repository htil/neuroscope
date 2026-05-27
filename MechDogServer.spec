# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

spec_root = os.getcwd()
print(f'[PYINSTALLER] Working directory (spec_root): {spec_root}')

sys.path.insert(0, os.path.join(spec_root, 'resources', 'python'))

hiddenimports = []
hiddenimports += collect_submodules('websockets')
hiddenimports += collect_submodules('websocket')
hiddenimports += collect_submodules('bleak')
hiddenimports += collect_submodules('ssl')
hiddenimports += collect_submodules('asyncio')

datas = []
datas += collect_data_files('websockets')
datas += collect_data_files('bleak')

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
