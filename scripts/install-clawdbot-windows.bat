@echo off
:: Clawdbot Auto Installer Launcher
:: Double-click to run - No configuration needed

title Clawdbot Installing...

:: Check admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Admin privileges required...
    echo Requesting admin rights...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Run PowerShell script with bypass policy
powershell -NoProfile -ExecutionPolicy Bypass -Command "^
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path; ^
$scriptPath = Join-Path $scriptDir 'install-clawdbot-windows.ps1'; ^
if (Test-Path $scriptPath) { . $scriptPath } else { ^
Write-Host 'ERROR: Script not found' -ForegroundColor Red; ^
Write-Host 'Make sure .bat and .ps1 are in the same folder' -ForegroundColor Yellow; ^
pause }"

if %errorLevel% neq 0 (
    echo.
    echo Installation failed. Press any key to exit...
    pause >nul
)
