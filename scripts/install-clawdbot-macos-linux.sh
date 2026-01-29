#!/bin/bash
# ==============================================
#  Clawdbot 全自动安装脚本 (macOS / Linux)
#  无需手动操作，自动安装所有依赖
# ==============================================set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 输出函数
success() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${CYAN}ℹ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
step() { echo -e "${YELLOW}▶ $1${NC}"; }

# 清屏并显示标题
clear
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   Clawdbot 全自动安装脚本${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${CYAN}此脚本将自动：${NC}"
echo -e "  ${GREEN}✓ 检查/安装 Node.js${NC}"
echo -e "  ${GREEN}✓ 检查/安装 Git${NC}"
echo -e "  ${GREEN}✓ 安装 pnpm${NC}"
echo -e "  ${GREEN}✓ 下载并安装 Clawdbot${NC}"
echo -e "  ${YELLOW}✓ 配置 AI 模型 API 密钥${NC}"
echo ""

# 创建临时目录
TEMP_DIR="/tmp/clawdbot_install"
mkdir -p "$TEMP_DIR"

# ========== 1. 检测操作系统 ==========
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac
info "检测到系统: $MACHINE"

# ========== 2. 检查/安装 Node.js ==========
step "步骤 1/6: 检查 Node.js..."
NODE_VERSION_REQUIRED=22

if ! command -v node &> /dev/null; then
    info "Node.js 未安装，正在安装..."

    if [ "$MACHINE" = "Mac" ]; then
        # macOS 使用 Homebrew
        if ! command -v brew &> /dev/null; then
            info "正在安装 Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install node
    else
        # Linux 使用 nvm 安装
        if [ ! -d "$HOME/.nvm" ]; then
            info "正在安装 nvm..."
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        fi
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install 22
        nvm use 22
    fi
    success "Node.js 安装完成"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt $NODE_VERSION_REQUIRED ]; then
        warning "Node.js 版本过低 (v$NODE_VERSION)，需要 v$NODE_VERSION_REQUIRED+"
        info "请手动升级 Node.js"
        exit 1
    fi
    success "Node.js 版本: $(node --version)"
fi

# ========== 3. 检查/安装 Git ==========
step "步骤 2/6: 检查 Git..."

if ! command -v git &> /dev/null; then
    info "Git 未安装，正在安装..."

    if [ "$MACHINE" = "Mac" ]; then
        brew install git
    else
        sudo apt-get update && sudo apt-get install -y git
    fi
    success "Git 安装完成"
else
    success "Git: $(git --version)"
fi

# ========== 4. 安装 pnpm ==========
step "步骤 3/6: 安装 pnpm..."

if ! command -v pnpm &> /dev/null; then
    info "正在全局安装 pnpm..."
    npm install -g pnpm --silent
    success "pnpm 安装完成"
else
    success "pnpm 版本: $(pnpm --version)"
fi

# ========== 5. 设置安装目录 ==========
step "步骤 4/6: 设置安装目录..."
INSTALL_DIR="$HOME/clawdbot"
info "安装目录: $INSTALL_DIR"

if [ -d "$INSTALL_DIR" ]; then
    warning "目录已存在，将进行覆盖安装"
    rm -rf "$INSTALL_DIR"
fi

# ========== 6. 下载并安装 Clawdbot ==========
step "步骤 5/6: 下载 Clawdbot..."
info "正在从 GitHub 克隆源码（可能需要几分钟）..."

git clone --depth 1 --quiet https://github.com/moltbot/moltbot.git "$INSTALL_DIR"
if [ -f "$INSTALL_DIR/package.json" ]; then
    success "下载完成"
else
    error "下载失败，请检查网络连接"
    exit 1
fi

cd "$INSTALL_DIR"

info "正在安装依赖（需要几分钟，请耐心等待）..."
if ! pnpm install --silent; then
    warning "安装遇到问题，重试中..."
    pnpm install
fi
success "依赖安装完成"

info "正在构建组件..."
pnpm ui:build --silent 2>/dev/null || pnpm ui:build
pnpm build --silent 2>/dev/null || pnpm build
success "构建完成"

# ========== 7. 创建启动脚本 ==========
step "步骤 6/6: 创建快捷启动脚本..."

START_SCRIPT="$HOME/Desktop/start-clawdbot.sh"

cat > "$START_SCRIPT" << 'EOF'
#!/bin/bash
# Clawdbot 启动脚本

echo "========================================"
echo "   Clawdbot 服务启动"
echo "========================================"
echo ""

cd "$HOME/clawdbot"

echo "[1] 启动 Clawdbot 服务 (端口 18789)"
echo "[2] 配置 AI 模型"
echo "[3] 查看状态"
echo "[0] 退出"
echo ""

read -p "请选择 [0-3]: " choice

case $choice in
    1)
        echo "正在启动服务..."
        pnpm moltbot gateway --port 18789
        ;;
    2)
        echo "启动配置向导..."
        pnpm moltbot onboard --install-daemon
        read -p "按 Enter 返回主菜单"
        exec "$0"
        ;;
    3)
        pnpm moltbot doctor
        read -p "按 Enter 返回主菜单"
        exec "$0"
        ;;
    0)
        echo "再见！"
        exit 0
        ;;
    *)
        echo "无效选择"
        ;;
esac
EOF

chmod +x "$START_SCRIPT"

# ========== 完成 ==========
echo ""
success "========================================"
success "   安装完成！"
success "========================================"
echo ""
warning "========================================"
warning "  重要: 需要配置 AI 模型 API 密钥"
warning "========================================"
echo ""
echo -e "${CYAN}配置向导将引导你完成以下设置:${NC}"
echo -e "  ${WHITE}- 选择 AI 模型 (Anthropic Claude / OpenAI GPT)${NC}"
echo -e "  ${WHITE}- 输入 API 密钥${NC}"
echo -e "  ${WHITE}- 选择消息渠道${NC}"
echo ""
echo -e "${YELLOW}【API 密钥获取地址】${NC}"
echo -e "  ${GRAY}Anthropic: https://console.anthropic.com/${NC}"
echo -e "  ${GRAY}OpenAI:     https://platform.openai.com/api-keys${NC}"
echo ""

read -p "按 Enter 启动配置向导，或输入 N 跳过: " response

if [[ "$response" != "N" && "$response" != "n" ]]; then
    echo ""
    info "正在启动配置向导..."
    pnpm moltbot onboard --install-daemon
fi

echo ""
success "========================================"
success "   Clawdbot 安装成功！"
success "========================================"
echo ""
info "桌面已创建快捷启动脚本: start-clawdbot.sh"
info "以后双击即可启动 Clawdbot"
echo ""
echo -e "${YELLOW}【常用命令】${NC}"
echo -e "  ${CYAN}启动服务:${NC}     pnpm moltbot gateway --port 18789"
echo -e "  ${CYAN}配置向导:${NC}     pnpm moltbot onboard"
echo -e "  ${CYAN}查看状态:${NC}     pnpm moltbot doctor"
echo ""

if [ "$MACHINE" = "Linux" ]; then
    info "提示: 可使用 systemd 管理服务"
    echo "  启动: systemctl --user start moltbot-gateway"
    echo ""
fi

info "文档: https://docs.molt.bot"
info "Discord: https://discord.gg/clawd"

# 清理临时文件
rm -rf "$TEMP_DIR"
