#!/bin/bash
#===============================================================================
# WAAudio Demo 内网穿透脚本
# 
# 使用方法：
#   ./expose.sh localtunnel   # 使用 localtunnel (免费，无需配置)
#   ./expose.sh cloudflared  # 使用 cloudflared (需要安装)
#   ./expose.sh vercel       # 部署到 Vercel
#===============================================================================

set -e

OPENCLAW_DIR="$HOME/.openclaw/workspace/WAAudio-demo"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%H:%M:%S')] $1"
}

# 安装依赖
install_deps() {
    log "${YELLOW}检查依赖...${NC}"
    
    cd "$OPENCLAW_DIR"
    
    if ! command -v npm &> /dev/null; then
        log "${RED}npm 未安装${NC}"
        exit 1
    fi
    
    npm install
    
    # 安装内网穿透工具
    if ! command -v npx &> /dev/null; then
        log "${RED}npx 未安装${NC}"
        exit 1
    fi
    
    log "${GREEN}依赖安装完成${NC}"
}

# 构建项目
build() {
    log "${YELLOW}构建项目...${NC}"
    cd "$OPENCLAW_DIR"
    npm run build
    log "${GREEN}构建完成${NC}"
}

# 使用 localtunnel (推荐)
localtunnel() {
    log "${GREEN}启动 localtunnel...${NC}"
    
    cd "$OPENCLAW_DIR"
    
    # 启动 Vite 服务器
    npm run dev -- --host 0.0.0.0 &
    local vite_pid=$!
    
    # 等待服务器启动
    sleep 3
    
    # 启动 localtunnel
    npx localtunnel --port 5173 --subdomain waaudio-demo
    
    # 清理
    kill $vite_pid 2>/dev/null || true
}

# 使用 cloudflared (需要安装)
cloudflared() {
    if ! command -v cloudflared &> /dev/null; then
        log "${YELLOW}安装 cloudflared...${NC}"
        brew install cloudflared
    fi
    
    log "${GREEN}启动 cloudflared 隧道...${NC}"
    
    cd "$OPENCLAW_DIR"
    
    # 启动 Vite 服务器
    npm run dev -- --host 0.0.0.0 &
    local vite_pid=$!
    
    sleep 3
    
    # 启动隧道
    cloudflared tunnel --url http://localhost:5173
    
    kill $vite_pid 2>/dev/null || true
}

# 部署到 Vercel
vercel_deploy() {
    log "${GREEN}部署到 Vercel...${NC}"
    
    cd "$OPENCLAW_DIR"
    
    # 构建
    npm run build
    
    # 部署
    npx vercel --prod
    
    log "${GREEN}部署完成！${NC}"
}

# 查看状态
status() {
    log "${YELLOW}WAAudio Demo 状态:${NC}"
    
    # 检查进程
    if pgrep -f "vite.*waaudio" > /dev/null; then
        log "${GREEN}✅ Vite 服务器正在运行${NC}"
    else
        log "${RED}❌ Vite 服务器未运行${NC}"
    fi
    
    # 检查端口
    if lsof -i :5173 > /dev/null 2>&1; then
        log "${GREEN}✅ 端口 5173 正在监听${NC}"
    else
        log "${YELLOW}⚠️ 端口 5173 未监听${NC}"
    fi
}

# 停止服务
stop() {
    log "${YELLOW}停止服务...${NC}"
    
    pkill -f "vite.*waaudio" || true
    pkill -f "localtunnel" || true
    pkill -f "cloudflared.*5173" || true
    
    log "${GREEN}已停止${NC}"
}

# 主入口
case "$1" in
    localtunnel)
        install_deps
        localtunnel
        ;;
    cloudflared)
        install_deps
        cloudflared
        ;;
    vercel)
        build
        vercel_deploy
        ;;
    build)
        build
        ;;
    status)
        status
        ;;
    stop)
        stop
        ;;
    *)
        echo "WAAudio Demo 内网穿透脚本"
        echo ""
        echo "使用方式: $0 <命令>"
        echo ""
        echo "命令:"
        echo "  localtunnel  - 使用 localtunnel (推荐，无需配置)"
        echo "  cloudflared   - 使用 cloudflared (需要安装)"
        echo "  vercel        - 部署到 Vercel (永久访问)"
        echo "  build         - 仅构建项目"
        echo "  status        - 查看状态"
        echo "  stop          - 停止服务"
        echo ""
        echo "推荐:"
        echo "  快速测试: $0 localtunnel"
        echo "  永久部署: $0 vercel"
        ;;
esac
