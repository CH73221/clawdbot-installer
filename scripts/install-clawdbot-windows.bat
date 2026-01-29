@echo off
:: ==============================================
::  Clawdbot 全自动安装启动器 (Windows)
::  双击运行即可，无需任何设置
:: ==============================================

chcp 65001 >nul 2>&1
title Clawdbot 安装中...

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ========================================
    echo    需要管理员权限运行安装程序
    echo ========================================
    echo.
    echo 正在请求管理员权限...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: 创建临时 PowerShell 脚本（包含执行策略设置）
set "TEMP_PS=%TEMP%\clawdbot_install_%RANDOM%.ps1"

(
echo # Clawdbot 临时安装脚本
echo Set-ExecutionPolicy Bypass -Scope Process -Force
echo $scriptPath = Join-Path $PSScriptRoot 'install-clawdbot-windows.ps1'
echo if ^(Test-Path $scriptPath^) {
echo     . $scriptPath
echo } else {
echo     Write-Host "错误: 找不到 install-clawdbot-windows.ps1" -ForegroundColor Red
echo     Write-Host "请确保 .bat 和 .ps1 文件在同一目录" -ForegroundColor Yellow
echo     pause
echo }
) > "%TEMP_PS%"

:: 运行 PowerShell 脚本
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS%"

:: 清理临时文件
if exist "%TEMP_PS%" del "%TEMP_PS%"

:: 如果脚本出错，暂停显示
if %errorLevel% neq 0 (
    echo.
    echo 安装过程中出现错误，按任意键退出...
    pause >nul
)
