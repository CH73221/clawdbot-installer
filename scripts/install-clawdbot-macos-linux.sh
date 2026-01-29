#!/bin/bash
# ==============================================
#  Clawdbot 一键安装脚本 (macOS / Linux)
#  ==============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 输出函数
success() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${CYAN}ℹ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

# 清屏并显示标题
clear
echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}   Clawdbot 一键安装脚本${NC}"
echo -e "${CYAN}===================================${NC}"
echo ""
echo -e "${YELLOW}重要提示: 安装过程中需要配置 AI 模型的 API 密钥${NC}"
echo ""
echo -e "${CYAN}请提前准备以下任一 API 密钥:${NC}"
echo -e "  ${YELLOW}1. Anthropic API Key (推荐 Claude Opus 4.5)${NC}"
echo -e "     ${GRAY}获取地址: https://console.anthropic.com/${NC}"
echo -e "  ${YELLOW}2. OpenAI API Key${NC}"
echo -e "     ${GRAY}获取地址: https://platform.openai.com/api-keys${NC}"
echo ""
echo -e "${CYAN}如果没有 API 密钥，配置向导也可以稍后通过以下命令重新运行:${NC}"
echo -e "   ${GREEN}pnpm moltbot onboard${NC}"
echo ""
read -p "按 Enter 继续，或按 Ctrl+C 取消..."
echo ""

# 检测操作系统
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac
info "检测到系统: $MACHINE"

# 1. 检查 Node.js 版本
info "检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    error "未检测到 Node.js"
    info "请安装 Node.js 22+:"
    if [ "$MACHINE" = "Mac" ]; then
        echo "  brew install node"
    else
        echo "  访问 https://nodejs.org"
    fi
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    error "需要 Node.js 22 或更高版本！当前: v$NODE_VERSION"
    exit 1
fi
success "Node.js 版本: $(node --version)"

# 2. 检查 Git
info "检查 Git..."
if ! command -v git &> /dev/null; then
    error "未检测到 Git"
    info "请先安装 Git"
    exit 1
fi
success "Git: $(git --version)"

# 3. 安装 pnpm（如果没有）
info "检查 pnpm..."
if ! command -v pnpm &> /dev/null; then
    info "正在安装 pnpm..."
    npm install -g pnpm
    success "pnpm 安装完成"
else
    success "pnpm 版本: $(pnpm --version)"
fi

# 4. 设置安装目录
INSTALL_DIR="$HOME/clawdbot"
info "安装目录: $INSTALL_DIR"

# 5. 克隆仓库
if [ -d "$INSTALL_DIR" ]; then
    warning "目录已存在: $INSTALL_DIR"
    read -p "是否覆盖安装? (Y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        info "安装已取消"
        exit 0
    fi
fi

info "正在下载 Clawdbot 源码..."
git clone --depth 1 https://github.com/moltbot/moltbot.git "$INSTALL_DIR"
success "下载完成"

# 6. 安装依赖
cd "$INSTALL_DIR"
info "正在安装依赖 (可能需要几分钟)..."
pnpm install
success "依赖安装完成"

# 7. 构建 UI
info "正在构建 UI..."
pnpm ui:build
success "UI 构建完成"

# 8. 构建
info "正在构建 Clawdbot..."
pnpm build
success "构建完成"

# 9. 运行配置向导
echo ""
success "==================================="
success "   安装完成！"
success "==================================="
echo ""
warning "========================================"
warning "  下一步: 配置 AI 模型 API 密钥"
warning "========================================"
echo ""
echo -e "${CYAN}配置向导将引导你完成以下设置:${NC}"
echo -e "  ${WHITE}- 选择 AI 模型 (Anthropic Claude / OpenAI GPT)${NC}"
echo -e "  ${WHITE}- 输入 API 密钥${NC}"
echo -e "  ${WHITE}- 选择消息渠道 (WhatsApp / Telegram / Discord 等)${NC}"
echo -e "  ${WHITE}- 安装系统服务${NC}"
echo ""
echo -e "${YELLOW}【API 密钥获取地址】${NC}"
echo -e "  ${GRAY}Anthropic: https://console.anthropic.com/${NC}"
echo -e "  ${GRAY}OpenAI:     https://platform.openai.com/api-keys${NC}"
echo ""
info "如果没有 API 密钥，可以稍后运行: pnpm moltbot onboard"
echo ""
read -p "按 Enter 启动配置向导，或按 Ctrl+C 跳过..."
echo ""

pnpm moltbot onboard --install-daemon

echo ""
success "==================================="
success "   Clawdbot 安装成功！"
success "==================================="
echo ""
info "常用命令:"
echo -e "  ${CYAN}启动服务:${NC}     pnpm moltbot gateway --port 18789"
echo -e "  ${CYAN}发送消息:${NC}     pnpm moltbot message send --to +1234567890 --message 'Hello'"
echo -e "  ${CYAN}与AI对话:${NC}     pnpm moltbot agent --message '你好'"
echo -e "  ${CYAN}查看状态:${NC}     pnpm moltbot doctor"
echo ""
info "文档: https://docs.molt.bot"
info "Discord: https://discord.gg/clawd"
echo ""

# 为 Linux 用户添加系统服务提示
if [ "$MACHINE" = "Linux" ]; then
    info "提示: 已安装 systemd 服务，使用以下命令管理:"
    echo -e "  ${CYAN}启动服务:${NC}     systemctl --user start moltbot-gateway"
    echo -e "  ${CYAN}停止服务:${NC}     systemctl --user stop moltbot-gateway"
    echo -e "  ${CYAN}查看状态:${NC}     systemctl --user status moltbot-gateway"
    echo ""
fi
