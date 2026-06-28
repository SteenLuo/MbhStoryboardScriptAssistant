@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\Stop-MbhAssistant.ps1"
if errorlevel 1 (
  echo.
  echo Stop failed. Please send the message above to the maintainer.
)
echo.
pause
