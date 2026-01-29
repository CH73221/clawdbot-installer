# ==============================================
#  Clawdbot 一键安装脚本 (Windows)
#  ==============================================

param(
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Clawdbot 安装中..."

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

# 检查管理员权限
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# 开始
Clear-Host
Write-Info "==================================="
Write-Info "   Clawdbot 一键安装脚本"
Write-Info "==================================="
Write-Host ""
Write-Warning "重要提示: 安装过程中需要配置 AI 模型的 API 密钥"
Write-Host ""
Write-Info "请提前准备以下任一 API 密钥:"
Write-Host "  1. Anthropic API Key (推荐 Claude Opus 4.5)" -ForegroundColor Yellow
Write-Host "     获取地址: https://console.anthropic.com/" -ForegroundColor Gray
Write-Host "  2. OpenAI API Key" -ForegroundColor Yellow
Write-Host "     获取地址: https://platform.openai.com/api-keys" -ForegroundColor Gray
Write-Host ""
Write-Info "如果没有 API 密钥，配置向导也可以稍后通过以下命令重新运行:"
Write-Host "  pnpm moltbot onboard" -ForegroundColor Cyan
Write-Host ""
$response = Read-Host "按 Enter 继续，或按 Ctrl+C 取消"
Write-Host ""

# 1. 检查 Node.js 版本
Write-Info "检查 Node.js 版本..."
try {
    $nodeVersion = node --version
    $nodeVersionNumber = [int]($nodeVersion -replace 'v', '' -split '\.')[0]
    if ($nodeVersionNumber -lt 22) {
        Write-Error "需要 Node.js 22 或更高版本！当前版本: $nodeVersion"
        Write-Info "请访问 https://nodejs.org 下载最新版本"
        exit 1
    }
    Write-Success "Node.js 版本: $nodeVersion"
} catch {
    Write-Error "未检测到 Node.js，请先安装 Node.js 22+"
    Write-Info "下载地址: https://nodejs.org"
    exit 1
}

# 2. 检查 Git
Write-Info "检查 Git..."
try {
    $gitVersion = git --version
    Write-Success "Git: $gitVersion"
} catch {
    Write-Error "未检测到 Git，请先安装 Git"
    Write-Info "下载地址: https://git-scm.com/downloads"
    exit 1
}

# 3. 安装 pnpm（如果没有）
Write-Info "检查 pnpm..."
try {
    $pnpmVersion = pnpm --version
    Write-Success "pnpm 版本: $pnpmVersion"
} catch {
    Write-Info "正在安装 pnpm..."
    npm install -g pnpm
    if ($LASTEXITCODE -eq 0) {
        Write-Success "pnpm 安装成功"
    } else {
        Write-Error "pnpm 安装失败"
        exit 1
    }
}

# 4. 设置安装目录
$installDir = "$env:USERPROFILE\clawdbot"
Write-Info "安装目录: $installDir"

# 5. 克隆仓库
if (Test-Path $installDir) {
    if ($Force) {
        Write-Warning "删除现有目录..."
        Remove-Item -Recurse -Force $installDir
    } else {
        Write-Warning "目录已存在: $installDir"
        $response = Read-Host "是否覆盖安装? (Y/N)"
        if ($response -ne "Y" -and $response -ne "y") {
            Write-Info "安装已取消"
            exit 0
        }
        Remove-Item -Recurse -Force $installDir
    }
}

Write-Info "正在下载 Clawdbot 源码..."
try {
    git clone --depth 1 https://github.com/moltbot/moltbot.git $installDir
    Write-Success "下载完成"
} catch {
    Write-Error "下载失败: $_"
    exit 1
}

# 6. 安装依赖
Set-Location $installDir
Write-Info "正在安装依赖 (可能需要几分钟)..."
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "依赖安装失败"
    exit 1
}
Write-Success "依赖安装完成"

# 7. 构建 UI
Write-Info "正在构建 UI..."
pnpm ui:build
if ($LASTEXITCODE -ne 0) {
    Write-Error "UI 构建失败"
    exit 1
}
Write-Success "UI 构建完成"

# 8. 构建
Write-Info "正在构建 Clawdbot..."
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Error "构建失败"
    exit 1
}
Write-Success "构建完成"

# 9. 运行配置向导
Write-Host ""
Write-Success "==================================="
Write-Success "   安装完成！"
Write-Success "==================================="
Write-Host ""
Write-Warning "========================================"
Write-Warning "  下一步: 配置 AI 模型 API 密钥"
Write-Warning "========================================"
Write-Host ""
Write-Host "配置向导将引导你完成以下设置:" -ForegroundColor Cyan
Write-Host "  - 选择 AI 模型 (Anthropic Claude / OpenAI GPT)" -ForegroundColor White
Write-Host "  - 输入 API 密钥" -ForegroundColor White
Write-Host "  - 选择消息渠道 (WhatsApp / Telegram / Discord 等)" -ForegroundColor White
Write-Host "  - 安装系统服务" -ForegroundColor White
Write-Host ""
Write-Host "【API 密钥获取地址】" -ForegroundColor Yellow
Write-Host "  Anthropic: https://console.anthropic.com/" -ForegroundColor Gray
Write-Host "  OpenAI:     https://platform.openai.com/api-keys" -ForegroundColor Gray
Write-Host ""
Write-Info "如果没有 API 密钥，可以稍后运行: pnpm moltbot onboard"
Write-Host ""
$response = Read-Host "按 Enter 启动配置向导，或按 Ctrl+C 跳过"
Write-Host ""

pnpm moltbot onboard --install-daemon

Write-Host ""
Write-Success "==================================="
Write-Success "   Clawdbot 安装成功！"
Write-Success "==================================="
Write-Host ""
Write-Info "常用命令:"
Write-Host "  启动服务:     pnpm moltbot gateway --port 18789" -ForegroundColor Cyan
Write-Host "  发送消息:     pnpm moltbot message send --to +1234567890 --message 'Hello'" -ForegroundColor Cyan
Write-Host "  与AI对话:     pnpm moltbot agent --message '你好'" -ForegroundColor Cyan
Write-Host "  查看状态:     pnpm moltbot doctor" -ForegroundColor Cyan
Write-Host ""
Write-Info "文档: https://docs.molt.bot"
Write-Info "Discord: https://discord.gg/clawd"
Write-Host ""

# 保持窗口打开
Write-Info "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
