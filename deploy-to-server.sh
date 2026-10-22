#!/bin/bash
# 测试环境部署脚本
# 在服务器上执行此脚本

set -e

TEST_PATH="/var/www/my-app-test"

echo "===================================="
echo "开始部署到测试环境"
echo "路径: $TEST_PATH"
echo "===================================="

cd $TEST_PATH

echo ""
echo "[1/9] 拉取最新代码..."
echo "===================================="
git pull origin feature

echo ""
echo "[2/9] 安装依赖..."
echo "===================================="
npm install

# 确保定时任务所需的依赖也已安装
echo "检查定时任务依赖..."
npm list dotenv node-cron node-fetch@2 > /dev/null 2>&1 || npm install dotenv node-cron node-fetch@2

echo ""
echo "[3/9] 检查数据库 schema 变更..."
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
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    cp prisma/dev.db "prisma/dev.db.before-schema-change.${BACKUP_DATE}"
    echo "✅ 数据库已备份"
    
    echo "同步数据库结构..."
    npx prisma db push
else
    echo "✅ 未检测到 schema 变更，跳过数据库同步"
fi

echo ""
echo "[4/9] 生成Prisma Client..."
echo "===================================="
npx prisma generate

echo ""
echo "[5/9] 构建生产版本..."
echo "===================================="
rm -rf .next
npm run build

echo ""
echo "[6/9] 复制静态资源和环境变量..."
echo "===================================="
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env .next/standalone/.env

echo ""
echo "[7/9] 重启服务..."
echo "===================================="

# 检查是否存在定时任务脚本
if [ -f "cron-scheduler.js" ]; then
  echo "✅ 发现定时任务脚本，使用 ecosystem.config.js 管理"
  
  # 检查是否存在 ecosystem.config.js
  if [ -f "ecosystem.config.js" ]; then
    echo "使用 ecosystem.config.js 重启测试环境进程..."
    # 只删除测试环境进程，不影响生产环境
    pm2 delete smxgc-vibe-test 2>/dev/null || true
    pm2 delete smxgc-vibe-test-scheduler 2>/dev/null || true
    sleep 2
    pm2 start ecosystem.config.js
    pm2 save
  else
    echo "⚠️ 未找到 ecosystem.config.js，仅启动 Next.js 服务"
    pm2 stop smxgc-vibe-test 2>/dev/null || true
    sleep 2
    PORT=7371 pm2 start .next/standalone/server.js --name "smxgc-vibe-test"
    pm2 save
  fi
else
  echo "⚠️ 未找到 cron-scheduler.js，仅启动 Next.js 服务"
  pm2 stop smxgc-vibe-test 2>/dev/null || true
  sleep 2
  PORT=7371 pm2 start .next/standalone/server.js --name "smxgc-vibe-test"
  pm2 save
fi

echo ""
echo "[8/9] 验证服务状态..."
echo "===================================="
sleep 5

echo "PM2 进程状态:"
pm2 status

echo ""
echo "[9/9] 验证 API 响应..."
echo "===================================="
echo "最新数据日期:"
curl -s http://localhost:7371/api/data/latest-date
echo ""
echo ""
echo "可用日期数量:"
curl -s http://localhost:7371/api/data/dates | python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"{len(data.get('dates', []))} 个日期，最新: {data.get('dates', [])[:5]}\")" 2>/dev/null || echo "API 调用失败"

echo ""
echo "===================================="
echo "✅ 测试环境部署完成!"
echo "===================================="
echo ""
echo "访问地址: http://122.51.51.46:7371"
echo "查看日志: pm2 logs smxgc-vibe-test --lines 50"
echo ""
echo "🔄 如需回滚，执行以下命令："
echo "   cd $TEST_PATH"
echo "   ls -lt prisma/dev.db.backup.* prisma/dev.db.before-schema-change.* 2>/dev/null | head -3"
echo "   cp <最新备份文件> prisma/dev.db"
echo "   pm2 restart smxgc-vibe-test --update-env"
echo ""
