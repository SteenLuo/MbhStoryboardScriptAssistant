@echo off
setlocal
set "ROOT=%~dp0"
set "START_ARGS="
if /I "%~1"=="--no-open-browser" set "START_ARGS=-NoOpenBrowser"
if /I "%~1"=="/no-open-browser" set "START_ARGS=-NoOpenBrowser"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\Start-MbhAssistant.ps1" %START_ARGS%
if errorlevel 1 (
  echo.
  echo Startup failed. Please send the message above to the maintainer.
  pause
)
