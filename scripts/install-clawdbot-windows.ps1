# ==============================================
#  Clawdbot 全自动安装脚本 (Windows)
#  无需手动操作，自动安装所有依赖
# ==============================================

# 设置错误处理
$ErrorActionPreference = "Stop"

# 设置编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Clawdbot 安装中..."

# 全局错误处理
trap {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "发生错误: $_" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 颜色输出函数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green "✓ $args" }
function Write-Info { Write-ColorOutput Cyan "ℹ $args" }
function Write-Error { Write-ColorOutput Red "✗ $args" }
function Write-Warning { Write-ColorOutput Yellow "⚠ $args" }
function Write-Step { Write-ColorOutput Yellow "▶ $args" }

# 检查管理员权限
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Error "需要管理员权限运行此脚本！"
    Write-Info "请右键点击脚本，选择'以管理员身份运行'"
    Write-Info "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 开始安装
Clear-Host
Write-Info "========================================"
Write-Info "   Clawdbot 全自动安装脚本"
Write-Info "========================================"
Write-Host ""
Write-Info "此脚本将自动："
Write-Host "  ✓ 检查/安装 Node.js" -ForegroundColor Green
Write-Host "  ✓ 检查/安装 Git" -ForegroundColor Green
Write-Host "  ✓ 安装 pnpm" -ForegroundColor Green
Write-Host "  ✓ 下载并安装 Clawdbot" -ForegroundColor Green
Write-Host "  ✓ 配置 AI 模型 API 密钥" -ForegroundColor Yellow
Write-Host ""

# 创建临时目录
$tempDir = "$env:TEMP\clawdbot_install"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

# ========== 1. 检查/安装 Node.js ==========
Write-Step "步骤 1/6: 检查 Node.js..."
$nodeInstalled = $false
$nodeVersionRequired = "22"

try {
    $nodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -eq 0 -and $nodeVersion) {
        $versionNumber = [int]($nodeVersion -replace 'v', '' -split '\.')[0]
        if ($versionNumber -ge $nodeVersionRequired) {
            Write-Success "Node.js 已安装: $nodeVersion"
            $nodeInstalled = $true
        } else {
            Write-Warning "Node.js 版本过低: $nodeVersion (需要 $nodeVersionRequired+)"
        }
    } else {
        Write-Warning "Node.js 未安装"
    }
} catch {
    Write-Warning "Node.js 检测失败，将尝试安装"
}

if (-not $nodeInstalled) {
    Write-Info "正在下载 Node.js 安装程序..."
    $nodeUrl = "https://nodejs.org/dist/latest-v$nodeVersionRequired.x/node-v$nodeVersionRequired.x-x64.msi"
    $nodeInstaller = "$tempDir\node-installer.msi"

    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
        Write-Info "正在安装 Node.js（请稍候...）"
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait
        Write-Success "Node.js 安装完成"

        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        # 刷新系统环境变量（适用于当前会话）
        foreach ($level in "Machine", "User") {
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", $level) + ";" + $env:Path
        }
    } catch {
        Write-Error "Node.js 下载/安装失败"
        Write-Info "请手动下载安装: https://nodejs.org"
        Write-Info "按任意键退出..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# ========== 2. 检查/安装 Git ==========
Write-Step "步骤 2/6: 检查 Git..."
$gitInstalled = $false

try {
    $gitVersion = & git --version 2>&1
    if ($LASTEXITCODE -eq 0 -and $gitVersion) {
        Write-Success "Git 已安装: $gitVersion"
        $gitInstalled = $true
    } else {
        Write-Warning "Git 未安装"
    }
} catch {
    Write-Warning "Git 检测失败，将尝试安装"
}

if (-not $gitInstalled) {
    Write-Info "正在下载 Git 安装程序..."
    $gitUrl = "https://github.com/git-for-windows/git/releases/latest/download/Git-64-bit.exe"
    $gitInstaller = "$tempDir\git-installer.exe"

    try {
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing
        Write-Info "正在安装 Git（请稍候...）"
        Start-Process $gitInstaller -ArgumentList '/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-', '/COMPONENTS="GitLFS,associations"' -Wait
        Write-Success "Git 安装完成"

        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } catch {
        Write-Error "Git 下载/安装失败"
        Write-Info "请手动下载安装: https://git-scm.com/downloads"
        Write-Info "按任意键退出..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# ========== 3. 安装 pnpm ==========
Write-Step "步骤 3/6: 安装 pnpm..."
try {
    $pnpmVersion = & pnpm --version 2>&1
    if ($LASTEXITCODE -eq 0 -and $pnpmVersion) {
        Write-Success "pnpm 已安装: $pnpmVersion"
    } else {
        throw "pnpm not found"
    }
} catch {
    Write-Info "正在全局安装 pnpm..."
    & npm install -g pnpm --silent 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $pnpmVersion = & pnpm --version 2>&1
        Write-Success "pnpm 安装成功 (版本: $pnpmVersion)"
    } else {
        Write-Error "pnpm 安装失败"
        Write-Info "按任意键退出..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# ========== 4. 设置安装目录 ==========
Write-Step "步骤 4/6: 设置安装目录..."
$installDir = "$env:USERPROFILE\clawdbot"
Write-Info "安装目录: $installDir"

if (Test-Path $installDir) {
    Write-Warning "目录已存在，将进行覆盖安装"
    Remove-Item -Recurse -Force $installDir -ErrorAction SilentlyContinue
}

# ========== 5. 下载并安装 Clawdbot ==========
Write-Step "步骤 5/6: 下载 Clawdbot..."
Write-Info "正在从 GitHub 克隆源码（可能需要几分钟）..."

try {
    git clone --depth 1 --quiet https://github.com/moltbot/moltbot.git $installDir 2>$null
    if (Test-Path "$installDir\package.json") {
        Write-Success "下载完成"
    } else {
        throw "克隆失败"
    }
} catch {
    Write-Error "下载失败，请检查网络连接"
    Write-Info "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 进入安装目录
Set-Location $installDir

Write-Info "正在安装依赖（需要几分钟，请耐心等待）..."
pnpm install --silent 2>$null
if ($LASTEXITCODE -ne 0) {
    # 重试一次
    Write-Warning "安装遇到问题，重试中..."
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "依赖安装失败"
        Write-Info "按任意键退出..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}
Write-Success "依赖安装完成"

Write-Info "正在构建组件..."
pnpm ui:build --silent 2>$null
pnpm build --silent 2>$null
Write-Success "构建完成"

# ========== 6. 创建启动脚本 ==========
Write-Step "步骤 6/6: 创建快捷启动脚本..."

$startScript = @"
# Clawdbot 启动脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Clawdbot 服务启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd "$installDir"

Write-Host "[1] 启动 Clawdbot 服务 (端口 18789)" -ForegroundColor Yellow
Write-Host "[2] 配置 AI 模型" -ForegroundColor Yellow
Write-Host "[3] 查看状态" -ForegroundColor Yellow
Write-Host "[4] 发送测试消息" -ForegroundColor Yellow
Write-Host "[0] 退出" -ForegroundColor Yellow
Write-Host ""

`$choice = Read-Host "请选择 [0-4]"

switch (`$choice) {
    "1" {
        Write-Host "正在启动服务..." -ForegroundColor Green
        pnpm moltbot gateway --port 18789
    }
    "2" {
        Write-Host "启动配置向导..." -ForegroundColor Green
        pnpm moltbot onboard --install-daemon
        Read-Host "按 Enter 返回主菜单"
        & `"$PSCommandPath` `"$PSCommandPath`"
        exit
    }
    "3" {
        pnpm moltbot doctor
        Read-Host "按 Enter 返回主菜单"
        & `"$PSCommandPath` `"$PSCommandPath`"
        exit
    }
    "4" {
        `$phone = Read-Host "输入手机号 (格式: +86xxxxxxxxx)"
        `$message = Read-Host "输入消息内容"
        pnpm moltbot message send --to `$phone --message `$message
        Read-Host "按 Enter 返回主菜单"
        & `"$PSCommandPath` `"$PSCommandPath`"
        exit
    }
    "0" {
        Write-Host "再见！" -ForegroundColor Cyan
        exit
    }
    default {
        Write-Host "无效选择" -ForegroundColor Red
    }
}
"@

$startScript | Out-File -FilePath "$env:USERPROFILE\Desktop\Start-Clawdbot.ps1" -Encoding UTF8

# ========== 完成 ==========
Write-Host ""
Write-Success "========================================"
Write-Success "   安装完成！"
Write-Success "========================================"
Write-Host ""

Write-Warning "========================================"
Write-Warning "  重要: 需要配置 AI 模型 API 密钥"
Write-Warning "========================================"
Write-Host ""
Write-Host "配置向导将引导你完成以下设置:" -ForegroundColor Cyan
Write-Host "  - 选择 AI 模型 (Anthropic Claude / OpenAI GPT)" -ForegroundColor White
Write-Host "  - 输入 API 密钥" -ForegroundColor White
Write-Host "  - 选择消息渠道" -ForegroundColor White
Write-Host ""
Write-Host "【API 密钥获取地址】" -ForegroundColor Yellow
Write-Host "  Anthropic: https://console.anthropic.com/" -ForegroundColor Gray
Write-Host "  OpenAI:     https://platform.openai.com/api-keys" -ForegroundColor Gray
Write-Host ""

`$response = Read-Host "按 Enter 启动配置向导，或输入 N 跳过"

if (`$response -ne "N" -and `$response -ne "n") {
    Write-Host ""
    Write-Info "正在启动配置向导..."
    pnpm moltbot onboard --install-daemon
}

Write-Host ""
Write-Success "========================================"
Write-Success "   Clawdbot 安装成功！"
Write-Success "========================================"
Write-Host ""
Write-Info "桌面已创建快捷启动脚本: Start-Clawdbot.ps1"
Write-Info "以后双击即可启动 Clawdbot"
Write-Host ""
Write-Host "【常用命令】" -ForegroundColor Yellow
Write-Host "  启动服务:     pnpm moltbot gateway --port 18789" -ForegroundColor Cyan
Write-Host "  配置向导:     pnpm moltbot onboard" -ForegroundColor Cyan
Write-Host "  查看状态:     pnpm moltbot doctor" -ForegroundColor Cyan
Write-Host ""
Write-Info "文档: https://docs.molt.bot"
Write-Info "Discord: https://discord.gg/clawd"
Write-Host ""
Write-Info "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 清理临时文件
Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
