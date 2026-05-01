@echo off
setlocal

REM This script should be placed inside the neuroscope-emg folder

echo Starting Neuroscope EMG...

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Start the application
yarn serve

pause
