@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\Stop-MbhAssistant.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\Start-MbhAssistant.ps1"
if errorlevel 1 pause
