#!/bin/bash

# 部署脚本 - 用于自动化部署Next.js应用
# 用法: bash deploy.sh [production|test]

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 环境配置
if [ "$1" = "test" ]; then
    ENV_NAME="测试环境"
    DEPLOY_DIR="/var/www/my-app-test"
    BRANCH="develop"
    PORT=7371
    PM2_NAME="smxgc-vibe-test"
    ADMIN_URL="http://122.51.51.46:7371"
else
    ENV_NAME="生产环境"
    DEPLOY_DIR="/var/www/my-app"
    BRANCH="master"
    PORT=3002
    PM2_NAME="smxgc-vibe"
    ADMIN_URL="http://122.51.51.46"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  开始部署到 ${ENV_NAME}${NC}"
echo -e "${BLUE}========================================${NC}"

# 第1步: 验证Nginx配置
echo -e "\n${YELLOW}[1/8] 验证Nginx配置...${NC}"
NGINX_LINK=$(ls -la /etc/nginx/sites-enabled/ | grep -E "default|my-app" | awk '{print $NF}')
if [[ "$NGINX_LINK" == *"my-app" ]]; then
    echo -e "${RED}错误: Nginx链接了旧配置文件!${NC}"
    echo -e "${YELLOW}正在修复...${NC}"
    sudo rm /etc/nginx/sites-enabled/my-app 2>/dev/null || true
    sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl restart nginx
    echo -e "${GREEN}✓ Nginx配置已修复${NC}"
else
    echo -e "${GREEN}✓ Nginx配置正确${NC}"
fi

# 第2步: 进入部署目录
echo -e "\n${YELLOW}[2/8] 进入部署目录...${NC}"
cd "$DEPLOY_DIR" || {
    echo -e "${RED}错误: 目录 $DEPLOY_DIR 不存在!${NC}"
    exit 1
}
echo -e "${GREEN}✓ 当前目录: $(pwd)${NC}"

# 第3步: 拉取最新代码
echo -e "\n${YELLOW}[3/8] 拉取最新代码 (${BRANCH})...${NC}"
git pull origin "$BRANCH"
echo -e "${GREEN}✓ 代码已更新${NC}"

# 第4步: 检查.env文件
echo -e "\n${YELLOW}[4/8] 检查.env文件...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}错误: .env文件不存在!${NC}"
    echo -e "${YELLOW}请创建.env文件,参考模板:${NC}"
    echo 'DATABASE_URL="file:'"$DEPLOY_DIR"'/prisma/dev.db"'
    echo 'JWT_SECRET="your-jwt-secret-key-change-this-in-production"'
    echo 'ADMIN_PASSWORD="habtot-mevxop-5Qekbu"'
    echo 'SMTP_HOST="smtp.163.com"'
    echo 'SMTP_PORT="465"'
    echo 'SMTP_USER="smxgc_nav_sever@163.com"'
    echo 'SMTP_PASS="LEgFszv7RxdtfCsK"'
    echo 'NEXT_PUBLIC_API_URL="'"$ADMIN_URL"'"'
    exit 1
else
    echo -e "${GREEN}✓ .env文件存在${NC}"
    # 验证DATABASE_URL使用绝对路径
    if grep -q 'DATABASE_URL="file:/' .env; then
        echo -e "${GREEN}✓ DATABASE_URL使用绝对路径${NC}"
    else
        echo -e "${YELLOW}警告: DATABASE_URL可能未使用绝对路径${NC}"
    fi
fi

# 第5步: 同步数据库
echo -e "\n${YELLOW}[5/8] 同步数据库...${NC}"
npx prisma db push
npx prisma generate
echo -e "${GREEN}✓ 数据库已同步${NC}"

# 第6步: 清理并构建
echo -e "\n${YELLOW}[6/8] 清理并构建...${NC}"
rm -rf .next
npm run build
echo -e "${GREEN}✓ 构建完成${NC}"

# 第7步: 复制必要文件
echo -e "\n${YELLOW}[7/8] 复制文件到standalone...${NC}"
cp -r .next/static .next/standalone/.next/
cp .env .next/standalone/
mkdir -p .next/standalone/.next/server/pages
cp -r .next/server/pages/* .next/standalone/.next/server/pages/ 2>/dev/null || true
echo -e "${GREEN}✓ 文件已复制${NC}"

# 第8步: 重启服务
echo -e "\n${YELLOW}[8/8] 重启服务 (端口: $PORT)...${NC}"
PORT=$PORT pm2 restart "$PM2_NAME"
pm2 save
echo -e "${GREEN}✓ 服务已重启${NC}"

# 等待服务启动
echo -e "\n${YELLOW}等待服务启动...${NC}"
sleep 5

# 验证部署
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  验证部署结果${NC}"
echo -e "${BLUE}========================================${NC}"

# 测试HTTP状态码
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ HTTP状态码: $HTTP_CODE${NC}"
else
    echo -e "${RED}✗ HTTP状态码: $HTTP_CODE (异常)${NC}"
    exit 1
fi

# 检查PM2状态
PM2_STATUS=$(pm2 list | grep "$PM2_NAME" | awk '{print $18}')
if [ "$PM2_STATUS" = "online" ]; then
    echo -e "${GREEN}✓ PM2状态: online${NC}"
else
    echo -e "${RED}✗ PM2状态: $PM2_STATUS (异常)${NC}"
    exit 1
fi

# 测试API
API_TEST=$(curl -s http://localhost:$PORT/api/admin/status 2>/dev/null | python3 -m json.tool 2>/dev/null | head -3)
if [ -n "$API_TEST" ]; then
    echo -e "${GREEN}✓ API测试: 正常${NC}"
else
    echo -e "${YELLOW}⚠ API测试: 跳过(可能需要认证)${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ 部署完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${BLUE}访问地址:${NC} $ADMIN_URL"
echo -e "${YELLOW}重要提示:${NC}"
echo -e "1. 清除浏览器缓存 (Ctrl+Shift+Delete)"
echo -e "2. 按F12验证JS文件版本"
echo -e "3. 测试核心功能(登录、数据展示)"
echo -e "4. 检查Nginx错误日志: tail -n 20 /var/log/nginx/error.log"
echo -e ""
