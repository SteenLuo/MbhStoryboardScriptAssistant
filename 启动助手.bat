@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\Start-MbhAssistant.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Please send the message above to the maintainer.
  pause
)
