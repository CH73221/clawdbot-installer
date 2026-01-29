@echo off
title Clawdbot Installer

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting admin privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Downloading and running Clawdbot installer...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$url='https://raw.githubusercontent.com/CH73221/clawdbot-installer/refs/heads/main/scripts/install-clawdbot-windows.ps1'; ^
$script='$env:TEMP\clawdbot.ps1'; ^
Invoke-WebRequest -Uri $url -OutFile $script -UseBasicParsing; ^
& $script; ^
Remove-Item $script -ErrorAction SilentlyContinue"

if %errorLevel% neq 0 (
    echo.
    echo Installation failed. Press any key...
    pause >nul
)
