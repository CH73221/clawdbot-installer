# Clawdbot Auto Installer for Windows
# This script runs automatically - no manual input needed

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Clawdbot Installing..."

trap {
    Write-Host ""
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

function Write-Success { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Warning { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Step { Write-Host "[STEP] $args" -ForegroundColor Yellow }

# Check admin
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Admin privileges required!"
    Write-Info "Right-click and select 'Run as Administrator'"
    Read-Host "Press Enter to exit"
    exit 1
}

Clear-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Clawdbot Auto Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will automatically:" -ForegroundColor White
Write-Host "  - Check/Install Node.js" -ForegroundColor Green
Write-Host "  - Check/Install Git" -ForegroundColor Green
Write-Host "  - Install pnpm" -ForegroundColor Green
Write-Host "  - Download and install Clawdbot" -ForegroundColor Green
Write-Host "  - Setup AI model API key" -ForegroundColor Yellow
Write-Host ""

$tempDir = "$env:TEMP\clawdbot_install"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Step 1: Node.js
Write-Step "Step 1/6: Checking Node.js..."
$nodeInstalled = $false
try {
    $nodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -eq 0 -and $nodeVersion) {
        $versionNumber = [int]($nodeVersion -replace 'v', '' -split '\.')[0]
        if ($versionNumber -ge 22) {
            Write-Success "Node.js installed: $nodeVersion"
            $nodeInstalled = $true
        } else {
            Write-Warning "Node.js too old: $nodeVersion"
        }
    }
} catch {
    Write-Warning "Node.js not found"
}

if (-not $nodeInstalled) {
    Write-Info "Downloading Node.js installer..."
    $nodeUrl = "https://nodejs.org/dist/latest-v22.x/node-v22.x-x64.msi"
    $nodeInstaller = "$tempDir\node-installer.msi"
    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
        Write-Info "Installing Node.js (please wait)..."
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait
        Write-Success "Node.js installed"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        foreach ($level in "Machine", "User") {
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", $level) + ";" + $env:Path
        }
    } catch {
        Write-Error "Node.js install failed"
        Write-Info "Download manually: https://nodejs.org"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Step 2: Git
Write-Step "Step 2/6: Checking Git..."
$gitInstalled = $false
try {
    $gitVersion = & git --version 2>&1
    if ($LASTEXITCODE -eq 0 -and $gitVersion) {
        Write-Success "Git installed: $gitVersion"
        $gitInstalled = $true
    }
} catch {
    Write-Warning "Git not found"
}

if (-not $gitInstalled) {
    Write-Info "Downloading Git installer..."
    $gitUrl = "https://github.com/git-for-windows/git/releases/latest/download/Git-64-bit.exe"
    $gitInstaller = "$tempDir\git-installer.exe"
    try {
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing
        Write-Info "Installing Git (please wait)..."
        Start-Process $gitInstaller -ArgumentList '/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-' -Wait
        Write-Success "Git installed"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } catch {
        Write-Error "Git install failed"
        Write-Info "Download manually: https://git-scm.com/downloads"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Step 3: pnpm
Write-Step "Step 3/6: Installing pnpm..."
try {
    $pnpmVersion = & pnpm --version 2>&1
    if ($LASTEXITCODE -eq 0 -and $pnpmVersion) {
        Write-Success "pnpm installed: $pnpmVersion"
    } else {
        throw "pnpm not found"
    }
} catch {
    Write-Info "Installing pnpm globally..."
    & npm install -g pnpm --silent 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $pnpmVersion = & pnpm --version 2>&1
        Write-Success "pnpm installed (version: $pnpmVersion)"
    } else {
        Write-Error "pnpm install failed"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Step 4: Install Directory
Write-Step "Step 4/6: Setting install directory..."
$installDir = "$env:USERPROFILE\clawdbot"
Write-Info "Install dir: $installDir"

if (Test-Path $installDir) {
    Write-Warning "Directory exists, will overwrite"
    Remove-Item -Recurse -Force $installDir -ErrorAction SilentlyContinue
}

# Step 5: Download Clawdbot
Write-Step "Step 5/6: Downloading Clawdbot..."
Write-Info "Cloning from GitHub (may take a few minutes)..."

try {
    git clone --depth 1 --quiet https://github.com/moltbot/moltbot.git $installDir 2>$null
    if (Test-Path "$installDir\package.json") {
        Write-Success "Download complete"
    } else {
        throw "Clone failed"
    }
} catch {
    Write-Error "Download failed, check network"
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $installDir

Write-Info "Installing dependencies (please wait)..."
pnpm install --silent 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Issue detected, retrying..."
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Dependency install failed"
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Write-Success "Dependencies installed"

Write-Info "Building components..."
pnpm ui:build --silent 2>$null
pnpm build --silent 2>$null
Write-Success "Build complete"

# Step 6: Create Launcher
Write-Step "Step 6/6: Creating launcher..."

$startScript = @"
# Clawdbot Launcher
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Clawdbot Service Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd "$installDir"

Write-Host "[1] Start service (port 18789)" -ForegroundColor Yellow
Write-Host "[2] Configure AI model" -ForegroundColor Yellow
Write-Host "[3] Check status" -ForegroundColor Yellow
Write-Host "[0] Exit" -ForegroundColor Yellow
Write-Host ""

`$choice = Read-Host "Select [0-3]"

switch (`$choice) {
    "1" {
        Write-Host "Starting service..." -ForegroundColor Green
        pnpm moltbot gateway --port 18789
    }
    "2" {
        Write-Host "Starting config wizard..." -ForegroundColor Green
        pnpm moltbot onboard --install-daemon
        Read-Host "Press Enter to return"
        & `"$PSCommandPath`"
        exit
    }
    "3" {
        pnpm moltbot doctor
        Read-Host "Press Enter to return"
        & `"$PSCommandPath`"
        exit
    }
    "0" {
        Write-Host "Goodbye!" -ForegroundColor Cyan
        exit
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}
"@

$startScript | Out-File -FilePath "$env:USERPROFILE\Desktop\Start-Clawdbot.ps1" -Encoding UTF8

# Complete
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Configure AI model API key" -ForegroundColor Yellow
Write-Host ""
Write-Host "The wizard will guide you:" -ForegroundColor Cyan
Write-Host "  - Select AI model (Claude / GPT)" -ForegroundColor White
Write-Host "  - Enter API key" -ForegroundColor White
Write-Host "  - Select messaging channel" -ForegroundColor White
Write-Host ""
Write-Host "Get API key from:" -ForegroundColor Yellow
Write-Host "  Anthropic: https://console.anthropic.com/" -ForegroundColor Gray
Write-Host "  OpenAI:     https://platform.openai.com/api-keys" -ForegroundColor Gray
Write-Host ""

`$response = Read-Host "Press Enter to start config wizard, or N to skip"

if (`$response -ne "N" -and `$response -ne "n") {
    Write-Host ""
    Write-Info "Starting config wizard..."
    pnpm moltbot onboard --install-daemon
}

Write-Host ""
Write-Success "Clawdbot installed successfully!"
Write-Host ""
Write-Info "Launcher created on desktop: Start-Clawdbot.ps1"
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "  Start service: pnpm moltbot gateway --port 18789" -ForegroundColor Cyan
Write-Host "  Config wizard: pnpm moltbot onboard" -ForegroundColor Cyan
Write-Host "  Check status:  pnpm moltbot doctor" -ForegroundColor Cyan
Write-Host ""
Write-Info "Docs: https://docs.molt.bot"
Write-Info "Discord: https://discord.gg/clawd"
Write-Host ""
Read-Host "Press Enter to exit"

Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
