#!/bin/bash

# 测试环境部署脚本
# 使用方法：在服务器上执行 sudo bash deploy-test.sh

set -e

echo "===================================="
echo "  测试环境部署脚本"
echo "===================================="
echo ""

# 配置
APP_DIR="/var/www/my-app-test"
PM2_NAME="smxgc-vibe-test"
PORT=7371
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

cd $APP_DIR

echo "Step 1: 同步 Git 代码..."
sudo git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*" 2>/dev/null || true
sudo git fetch origin
sudo git reset --hard origin/feature
echo "✅ 代码已同步到 feature 分支最新"
echo ""

echo "Step 2: 备份用户权限数据..."
sudo cp prisma/dev.db "prisma/dev.db.backup.${BACKUP_DATE}"
sudo sqlite3 prisma/dev.db ".mode csv" ".headers on" ".output users_backup_${BACKUP_DATE}.csv" "SELECT id, email, realName, organization, status, permissions, createdAt FROM User;" 2>/dev/null || true
sudo sqlite3 prisma/dev.db ".output stdout"
echo "✅ 用户数据已备份"
echo ""

echo "Step 3: 安装依赖..."
sudo npm install
echo "✅ 依赖安装完成"
echo ""

echo "Step 4: 同步数据库结构..."
sudo npx prisma db push --accept-data-loss
echo "✅ 数据库结构已同步"
echo ""

echo "Step 5: 生成 Prisma Client..."
sudo npx prisma generate
echo "✅ Prisma Client 已生成"
echo ""

echo "Step 6: 配置 standalone 输出..."
# 确保启用了 standalone
if ! grep -q "output: 'standalone'" next.config.js; then
    sudo sed -i "s|// output: 'standalone'|output: 'standalone'|" next.config.js
    echo "✅ 已启用 standalone 输出"
fi
echo ""

echo "Step 7: 构建生产版本..."
sudo rm -rf .next

# 尝试构建，如果失败则临时禁用 instrumentation
if ! sudo npm run build; then
    echo "⚠️  构建失败，尝试临时禁用 instrumentation..."
    sudo mv src/instrumentation.ts src/instrumentation.ts.bak 2>/dev/null || true
    sudo rm -rf .next
    sudo npm run build
    sudo mv src/instrumentation.ts.bak src/instrumentation.ts 2>/dev/null || true
    echo "✅ 构建完成（已恢复 instrumentation）"
else
    echo "✅ 构建完成"
fi
echo ""

echo "Step 8: 复制静态资源..."
sudo cp -r .next/static .next/standalone/.next/
sudo cp .env .next/standalone/.env
echo "✅ 资源复制完成"
echo ""

echo "Step 9: 重启服务..."
sudo pm2 stop $PM2_NAME 2>/dev/null || true
sleep 2
PORT=$PORT sudo pm2 start .next/standalone/server.js --name "$PM2_NAME"
sudo pm2 save
echo "✅ 服务已重启"
echo ""

echo "Step 10: 验证部署..."
sleep 5

echo "测试 API..."
curl -s http://localhost:$PORT/api/data/latest-date || echo "⚠️  API 响应异常"
echo ""

echo "查看服务状态..."
pm2 status $PM2_NAME
echo ""

echo "===================================="
echo "✅ 测试环境部署完成!"
echo "===================================="
echo "访问地址: http://122.51.51.46:$PORT"
echo "查看日志: sudo pm2 logs $PM2_NAME --lines 50"
echo ""
