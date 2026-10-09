# 生产环境部署技能

## 概述

自动化部署 Next.js 应用到生产环境，包含完整的备份、验证和回滚机制。

## 前置条件

- 服务器路径：`/var/www/my-app-prod`（根据实际调整）
- 生产端口：`3000`（根据实际调整）
- PM2 进程名：`smxgc-vibe-prod`
- Git 分支：`main` 或 `master`
- 访问地址：生产域名

## 部署流程

### Step 0: 部署前检查清单 ✅

在开始部署前确认：

- [ ] 代码已合并到主分支并通过 Code Review
- [ ] 测试环境已验证通过
- [ ] 已通知用户可能的停机时间
- [ ] 准备好回滚方案
- [ ] 数据库迁移脚本已测试

### Step 1: 备份用户权限数据 ⚠️ 最关键步骤

```bash
cd /var/www/my-app-prod

# 创建备份目录
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"

# 1. 备份完整数据库
sudo cp prisma/dev.db "$BACKUP_DIR/dev.db.backup"
echo "✅ 数据库已备份：$BACKUP_DIR/dev.db.backup"

# 2. 导出用户数据（CSV 格式）
sudo sqlite3 prisma/dev.db ".mode csv" ".headers on" \
  ".output $BACKUP_DIR/users.csv" \
  "SELECT id, email, realName, phone, organization, department, position, status, permissions, createdAt, updatedAt FROM User;"

sudo sqlite3 prisma/dev.db ".output stdout"
echo "✅ 用户数据已导出：$BACKUP_DIR/users.csv"

# 3. 导出访问日志（可选，保留最近 30 天）
sudo sqlite3 prisma/dev.db ".mode csv" ".headers on" \
  ".output $BACKUP_DIR/access_logs.csv" \
  "SELECT * FROM AccessLog WHERE createdAt >= datetime('now', '-30 days');"

sudo sqlite3 prisma/dev.db ".output stdout"
echo "✅ 访问日志已导出：$BACKUP_DIR/access_logs.csv"

# 4. 备份 .env 配置文件
sudo cp .env "$BACKUP_DIR/.env.backup"
echo "✅ 配置文件已备份：$BACKUP_DIR/.env.backup"

# 5. 验证备份文件
echo ""
echo "=== 备份文件验证 ==="
ls -lh "$BACKUP_DIR/" | tail -10
echo "备份目录：$BACKUP_DIR"
```

### Step 2: 同步 Git 代码

```bash
cd /var/www/my-app-prod

# 获取最新代码
sudo git fetch origin main

# 查看当前分支状态
sudo git status

# 切换到主分支最新代码
sudo git reset --hard origin/main

echo "✅ 代码已同步到：$(sudo git log --oneline -1)"
```

### Step 3: 安装依赖

```bash
cd /var/www/my-app-prod

# 安装生产依赖
sudo npm ci --production  # 使用 ci 确保依赖版本一致
# 或
sudo npm install

echo "✅ 依赖安装完成"
```

### Step 4: 数据库迁移

```bash
cd /var/www/my-app-prod

# 方式 1：使用迁移（推荐，如果有迁移文件）
sudo npx prisma migrate deploy

# 方式 2：直接推送结构（无迁移文件时）
# sudo npx prisma db push --accept-data-loss

# 生成 Prisma Client
sudo npx prisma generate

echo "✅ 数据库同步完成"
```

### Step 5: 处理 instrumentation.ts（如需要）

```bash
cd /var/www/my-app-prod

# 检查是否需要临时禁用
if sudo grep -q "instrumentation" src/instrumentation.ts 2>/dev/null; then
  echo "⚠️  发现 instrumentation.ts，如构建失败需临时禁用"
fi
```

### Step 6: 构建生产版本

```bash
cd /var/www/my-app-prod

# 确保启用 standalone 模式
if ! sudo grep -q "output: 'standalone'" next.config.js; then
  echo "⚠️  next.config.js 未启用 standalone，正在修改..."
  sudo sed -i "s|// output: 'standalone'|output: 'standalone'|" next.config.js
fi

# 清理缓存
sudo rm -rf .next node_modules/.cache

# 构建
sudo npm run build

echo "✅ 构建完成"
```

### Step 7: 复制静态资源

```bash
cd /var/www/my-app-prod

# 复制资源
sudo cp -r .next/static .next/standalone/.next/
sudo cp -r public .next/standalone/ 2>/dev/null || true
sudo cp .env .next/standalone/.env

# 验证文件
echo "=== standalone 目录验证 ==="
ls -la .next/standalone/ | head -15

echo "✅ 资源复制完成"
```

### Step 8: 健康检查（启动前）

```bash
cd /var/www/my-app-prod

# 测试构建产物
node .next/standalone/server.js &
SERVER_PID=$!
sleep 5

# 测试 API
curl -s http://localhost:3000/api/data/latest-date
TEST_RESULT=$?

# 停止测试服务
kill $SERVER_PID 2>/dev/null

if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ 健康检查通过"
else
  echo "❌ 健康检查失败，请查看日志"
  exit 1
fi
```

### Step 9: 滚动重启服务（零停机）

```bash
cd /var/www/my-app-prod

# 方式 1：使用 PM2 零停机重启
sudo pm2 reload smxgc-vibe-prod --update-env

# 方式 2：如果 reload 失败，使用 stop/start
# sudo pm2 stop smxgc-vibe-prod
# sleep 2
# PORT=3000 sudo pm2 start .next/standalone/server.js --name "smxgc-vibe-prod"
# sudo pm2 save

# 等待服务启动
sleep 5

# 查看服务状态
pm2 status smxgc-vibe-prod

echo "✅ 服务已重启"
```

### Step 10: 验证部署

```bash
# 等待服务完全启动
sleep 5

echo "=== 部署验证 ==="

# 1. 测试 API
echo "1. 测试 API 响应..."
curl -s http://localhost:3000/api/data/latest-date
echo ""

# 2. 测试用户认证
echo "2. 测试用户认证..."
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"
echo ""

# 3. 检查服务日志
echo "3. 检查服务日志..."
sudo pm2 logs smxgc-vibe-prod --lines 20 --nostream | grep -E "(error|Error|ERROR|ready|Ready)" | tail -10

# 4. 验证数据库连接
echo "4. 验证数据库..."
sudo sqlite3 prisma/dev.db "SELECT COUNT(*) as user_count FROM User;"

echo ""
echo "===================================="
echo "✅ 生产环境部署完成!"
echo "===================================="
echo "访问地址: https://your-production-domain.com"
echo "服务状态: pm2 status smxgc-vibe-prod"
echo "查看日志: sudo pm2 logs smxgc-vibe-prod --lines 50"
echo ""
echo "⚠️  重要：请验证以下功能"
echo "   1. 用户登录正常"
echo "   2. 数据展示正常"
echo "   3. 管理员权限正常"
```

### Step 11: 部署后监控

```bash
# 持续监控服务 10 分钟
sudo pm2 logs smxgc-vibe-prod --lines 50

# 查看服务资源使用
pm2 monit

# 检查错误日志
sudo tail -f /root/.pm2/logs/smxgc-vibe-prod-error.log
```

## 回滚流程

### 如果部署失败，立即回滚

```bash
cd /var/www/my-app-prod

# 1. 停止当前服务
sudo pm2 stop smxgc-vibe-prod

# 2. 恢复上一个版本的代码
sudo git reset --hard HEAD~1  # 或指定 commit hash

# 3. 恢复数据库（如果需要）
# sudo cp backups/LATEST/dev.db.backup prisma/dev.db

# 4. 重新构建
sudo rm -rf .next
sudo npm run build
sudo cp -r .next/static .next/standalone/.next/
sudo cp .env .next/standalone/.env

# 5. 重启服务
PORT=3000 sudo pm2 start .next/standalone/server.js --name "smxgc-vibe-prod"
sudo pm2 save

echo "✅ 已回滚到上一个版本"
```

## 常见问题

### 1. 数据库迁移失败

**问题**：`P3005 The database schema is not empty`

**解决**：
```bash
# 先 baseline 现有数据库
sudo npx prisma migrate resolve --applied FIRST_MIGRATION_NAME
sudo npx prisma migrate deploy
```

### 2. 构建失败 - MODULE_NOT_FOUND

**问题**：`Cannot find module './instrumentation.node.mjs'`

**解决**：
```bash
sudo mv src/instrumentation.ts src/instrumentation.ts.bak
sudo rm -rf .next && sudo npm run build
sudo mv src/instrumentation.ts.bak src/instrumentation.ts
```

### 3. 用户数据丢失

**问题**：部署后用户无法登录

**解决**：
```bash
# 从备份恢复用户数据
cd backups/LATEST_BACKUP
sqlite3 ../prisma/dev.db ".mode csv" ".import users.csv User"
```

### 4. 服务启动失败

**问题**：PM2 显示 stopped 或 errored

**解决**：
```bash
# 查看详细错误
sudo pm2 logs smxgc-vibe-prod --err

# 检查端口占用
sudo lsof -i :3000

# 手动测试启动
cd /var/www/my-app-prod
PORT=3000 node .next/standalone/server.js
```

## 重要提醒

1. **⚠️ 部署前必须备份用户数据和数据库**
2. **⚠️ 在低峰时段部署（建议晚上或周末）**
3. **⚠️ 准备好回滚方案再开始部署**
4. **⚠️ 使用 sudo 执行所有命令**
5. **⚠️ 部署后验证用户登录和权限**
6. **⚠️ 保留至少 3 个版本的备份**
7. **⚠️ 通知用户可能的停机时间**
8. **⚠️ 监控服务至少 30 分钟**

## 部署检查清单

部署完成后确认：

- [ ] 数据库备份完成
- [ ] 用户数据导出完成
- [ ] 代码同步成功
- [ ] 依赖安装完成
- [ ] 数据库迁移完成
- [ ] 构建成功
- [ ] 资源复制完成
- [ ] 服务重启成功
- [ ] API 响应正常
- [ ] 用户登录正常
- [ ] 权限验证通过
- [ ] 错误日志无异常
- [ ] 监控 30 分钟无问题
