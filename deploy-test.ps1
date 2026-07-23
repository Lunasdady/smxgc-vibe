# ============================================
# 测试环境部署脚本
# ============================================
# 执行方式: 在PowerShell中运行此脚本
# 路径: g:\vibe coding\smxgc-vibe\deploy-test.ps1
# ============================================

$server = "ubuntu@122.51.51.46"
$testPath = "/var/www/my-app-test"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "开始部署到测试环境" -ForegroundColor Cyan
Write-Host "服务器: $server" -ForegroundColor Cyan
Write-Host "路径: $testPath" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 第1步: SSH连接并执行部署
Write-Host "[1/6] 连接到服务器..." -ForegroundColor Yellow
ssh $server @"
cd $testPath

echo '===================================='
echo '第2步: 拉取最新代码'
echo '===================================='
git pull origin feature

echo ''
echo '===================================='
echo '第3步: 安装依赖'
echo '===================================='
npm install

echo ''
echo '===================================='
echo '第4步: 同步数据库schema'
echo '===================================='
npx prisma db push

echo ''
echo '===================================='
echo '第5步: 生成Prisma Client'
echo '===================================='
npx prisma generate

echo ''
echo '===================================='
echo '第6步: 构建生产版本'
echo '===================================='
npm run build

echo ''
echo '===================================='
echo '第7步: 复制静态资源'
echo '===================================='
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

echo ''
echo '===================================='
echo '第8步: 确保.env文件存在'
echo '===================================='
if [ ! -f .env ]; then
    echo '创建.env文件...'
    cat > .env << 'EOF'
DATABASE_URL="file:/var/www/my-app-test/prisma/dev.db"
JWT_SECRET="smxgc-jwt-secret-2026-a7f3b9c1d5e8f2g4h6j7k9m0n2p4q6r8"
ADMIN_PASSWORD="habtot-mevxop-5Qekbu"
SMTP_HOST="smtp.163.com"
SMTP_PORT="465"
SMTP_USER="smxgc_nav_sever@163.com"
SMTP_PASS="LEgFszv7RxdtfCsK"
NEXT_PUBLIC_API_URL="http://122.51.51.46:7371"
EOF
fi

# 复制.env到standalone目录
cp .env .next/standalone/.env

echo ''
echo '===================================='
echo '第9步: 重启服务'
echo '===================================='
pm2 stop smxgc-vibe-test 2>/dev/null
PORT=7371 pm2 start .next/standalone/server.js --name "smxgc-vibe-test"
pm2 save

echo ''
echo '===================================='
echo '第10步: 验证部署'
echo '===================================='
echo '服务状态:'
pm2 status

echo ''
echo '等待3秒后测试API...'
sleep 3

echo ''
echo '测试latest-date API:'
curl -s http://localhost:7371/api/data/latest-date

echo ''
echo '测试首页数据API:'
curl -s "http://localhost:7371/api/strategies/overview?dataDate=2026-07-16&metric=excessReturn1w" | head -c 200

echo ''
echo '===================================='
echo '✅ 测试环境部署完成!'
echo '===================================='
echo ''
echo '请访问: http://122.51.51.46:7371'
echo '查看PM2日志: pm2 logs smxgc-vibe-test'
"@

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "部署脚本执行完成!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
