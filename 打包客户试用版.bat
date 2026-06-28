@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\New-CustomerTrialPackage.ps1"
if errorlevel 1 (
  echo.
  echo Package build failed. Please send the message above to the maintainer.
  pause
  exit /b 1
)
echo.
pause
