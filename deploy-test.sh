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

echo "Step 2: 备份数据库和用户权限数据..."
echo "===================================="
# 完整数据库备份
echo "📦 备份完整数据库..."
sudo cp prisma/dev.db "prisma/dev.db.backup.${BACKUP_DATE}"
echo "✅ 数据库完整备份完成: dev.db.backup.${BACKUP_DATE}"

# 备份用户权限数据
echo "📦 备份用户权限数据..."
sudo sqlite3 prisma/dev.db ".dump User" > "users_backup_${BACKUP_DATE}.sql" 2>/dev/null || true
USER_COUNT=$(sudo sqlite3 prisma/dev.db "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
echo "✅ 用户权限数据备份完成: $USER_COUNT 条记录"
echo ""

echo "Step 3: 安装依赖..."
sudo npm install
echo "✅ 依赖安装完成"
echo ""

echo "Step 4: 检查数据库 schema 变更..."
echo "===================================="
# 检查是否有 schema 变更
SCHEMA_CHANGES=$(git diff HEAD~1 -- prisma/schema.prisma 2>/dev/null | wc -l | tr -d ' ')

if [ "$SCHEMA_CHANGES" -gt 0 ]; then
    echo "⚠️  检测到数据库 schema 变更！"
    echo ""
    echo "变更内容："
    git diff HEAD~1 -- prisma/schema.prisma 2>/dev/null | head -50
    echo ""
    echo "⚠️  警告：如果继续，可能会修改数据库结构"
    read -p "确认继续执行数据库同步？(yes/no): " confirm_schema
    if [ "$confirm_schema" != "yes" ]; then
        echo "❌ 操作已取消"
        exit 1
    fi
    
    echo "📦 备份数据库..."
    sudo cp prisma/dev.db "prisma/dev.db.before-schema-change.${BACKUP_DATE}"
    echo "✅ 数据库已备份"
    
    echo "同步数据库结构..."
    sudo npx prisma db push
else
    echo "✅ 未检测到 schema 变更，跳过数据库同步"
fi
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
echo "🔄 如需回滚，执行以下命令："
echo "   cd $APP_DIR"
echo "   sudo cp prisma/dev.db.backup.${BACKUP_DATE} prisma/dev.db"
echo "   sudo pm2 restart $PM2_NAME --update-env"
echo ""
