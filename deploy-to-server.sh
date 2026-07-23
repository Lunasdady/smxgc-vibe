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
echo "[1/8] 拉取最新代码..."
echo "===================================="
git pull origin feature

echo ""
echo "[2/8] 安装依赖..."
echo "===================================="
npm install

echo ""
echo "[3/8] 同步数据库schema..."
echo "===================================="
npx prisma db push

echo ""
echo "[4/8] 生成Prisma Client..."
echo "===================================="
npx prisma generate

echo ""
echo "[5/8] 构建生产版本..."
echo "===================================="
rm -rf .next
npm run build

echo ""
echo "[6/8] 复制静态资源和环境变量..."
echo "===================================="
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env .next/standalone/.env

echo ""
echo "[7/8] 重启服务..."
echo "===================================="
pm2 stop smxgc-vibe-test 2>/dev/null || true
sleep 2
PORT=7371 pm2 start .next/standalone/server.js --name "smxgc-vibe-test"
pm2 save

echo ""
echo "[8/8] 验证部署..."
echo "===================================="
sleep 5

echo "服务状态:"
pm2 status

echo ""
echo "测试API响应:"
curl -s http://localhost:7371/api/data/latest-date
echo ""

echo ""
echo "===================================="
echo "✅ 测试环境部署完成!"
echo "===================================="
echo ""
echo "访问地址: http://122.51.51.46:7371"
echo "查看日志: pm2 logs smxgc-vibe-test --lines 50"
