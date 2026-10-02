@echo off
cd /d "%~dp0"
if exist "release-v0.5.0\win-unpacked\Aster.exe" (
  start "" "release-v0.5.0\win-unpacked\Aster.exe"
  exit /b 0
)
if exist "release\win-unpacked\Aster.exe" (
  start "" "release\win-unpacked\Aster.exe"
) else (
  if not exist "node_modules\electron" (
    echo Install Node.js 24 or newer, then run npm ci and npm run build first.
    pause
    exit /b 1
  )
  if not exist "dist-electron\main.cjs" (
    call npm run build
    if errorlevel 1 exit /b 1
  )
  call npm start
)
