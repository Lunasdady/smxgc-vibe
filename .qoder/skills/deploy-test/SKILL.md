# 测试环境部署技能

## 概述

自动化部署 Next.js 应用到测试环境（端口 7371）。

## 前置条件

- 服务器路径：`/var/www/my-app-test`
- 测试端口：`7371`
- PM2 进程名：`smxgc-vibe-test`
- Git 分支：`feature`
- 访问地址：`http://122.51.51.46:7371`

## 部署流程

### Step 1: 同步 Git 代码

```bash
cd /var/www/my-app-test

# 配置 Git 获取所有分支（仅首次需要）
sudo git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"

# 获取最新代码
sudo git fetch origin

# 切换到 feature 分支最新代码
sudo git reset --hard origin/feature
```

### Step 2: 备份用户权限数据 ⚠️ 关键步骤

```bash
cd /var/www/my-app-test

# 备份数据库
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
sudo cp prisma/dev.db "prisma/dev.db.backup.${BACKUP_DATE}"

# 导出用户数据
sudo sqlite3 prisma/dev.db ".mode csv" ".headers on" ".output users_backup_${BACKUP_DATE}.csv" "SELECT id, email, realName, organization, status, permissions, createdAt FROM User;"
sudo sqlite3 prisma/dev.db ".output stdout"

echo "✅ 用户数据已备份：users_backup_${BACKUP_DATE}.csv"
```

### Step 3: 安装依赖

```bash
cd /var/www/my-app-test
sudo npm install
```

### Step 4: 同步数据库结构

```bash
cd /var/www/my-app-test

# 尝试直接同步
sudo npx prisma db push --accept-data-loss

# 如果遇到唯一约束错误，先清空 FundProduct 表
# sudo sqlite3 prisma/dev.db "DELETE FROM FundProduct;"
# sudo npx prisma db push --accept-data-loss
```

### Step 5: 生成 Prisma Client

```bash
cd /var/www/my-app-test
sudo npx prisma generate
```

### Step 6: 处理 instrumentation.ts（如构建失败）

**如果构建时出现 `MODULE_NOT_FOUND: instrumentation.node.mjs` 错误**：

```bash
cd /var/www/my-app-test

# 临时禁用 instrumentation
sudo mv src/instrumentation.ts src/instrumentation.ts.bak

# 清理缓存并重新构建
sudo rm -rf .next
sudo npm run build

# 构建成功后恢复
sudo mv src/instrumentation.ts.bak src/instrumentation.ts
```

### Step 7: 构建生产版本

```bash
cd /var/www/my-app-test

# 确保 next.config.js 中启用了 standalone
sudo grep -q "output: 'standalone'" next.config.js || sudo sed -i "s|// output: 'standalone'|output: 'standalone'|" next.config.js

# 清理并构建
sudo rm -rf .next
sudo npm run build
```

### Step 8: 复制静态资源

```bash
cd /var/www/my-app-test

# 复制静态资源和环境变量
sudo cp -r .next/static .next/standalone/.next/
sudo cp .env .next/standalone/.env

echo "✅ 资源复制完成"
```

### Step 9: 重启服务

```bash
cd /var/www/my-app-test

# 停止旧服务
sudo pm2 stop smxgc-vibe-test 2>/dev/null || true
sleep 2

# 启动新服务
PORT=7371 sudo pm2 start .next/standalone/server.js --name "smxgc-vibe-test"

# 保存 PM2 配置
sudo pm2 save

# 查看服务状态
pm2 status
```

### Step 10: 验证部署

```bash
# 等待服务启动
sleep 5

# 测试 API
echo "=== 测试 API ==="
curl -s http://localhost:7371/api/data/latest-date
echo ""

curl -s http://localhost:7371/api/strategies/overview | head -c 100
echo ""

# 查看服务日志
sudo pm2 logs smxgc-vibe-test --lines 10 --nostream

echo ""
echo "===================================="
echo "✅ 测试环境部署完成!"
echo "===================================="
echo "访问地址: http://122.51.51.46:7371"
echo "查看日志: sudo pm2 logs smxgc-vibe-test --lines 50"
```

## 常见问题

### 1. Git 分支找不到

**问题**：`error: pathspec 'feature' did not match any file(s) known to git`

**解决**：
```bash
sudo git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
sudo git fetch origin
```

### 2. 数据库同步失败 - 唯一约束冲突

**问题**：`UNIQUE constraint failed: FundProduct.productCode, FundProduct.dataDate`

**解决**：
```bash
sudo sqlite3 prisma/dev.db "DELETE FROM FundProduct;"
sudo npx prisma db push --accept-data-loss
```

### 3. 构建失败 - MODULE_NOT_FOUND

**问题**：`Cannot find module './instrumentation.node.mjs'`

**解决**：
```bash
sudo mv src/instrumentation.ts src/instrumentation.ts.bak
sudo rm -rf .next && sudo npm run build
sudo mv src/instrumentation.ts.bak src/instrumentation.ts
```

### 4. standalone 目录不存在

**问题**：构建后没有生成 `.next/standalone` 目录

**解决**：检查 `next.config.js` 中是否有 `output: 'standalone'`

### 5. 权限拒绝

**问题**：`Permission denied`

**解决**：所有 Git 和构建命令前加 `sudo`

## 重要提醒

1. **⚠️ 部署前必须备份用户数据**
2. **⚠️ 使用 sudo 执行所有命令**
3. **⚠️ 确认 next.config.js 中启用了 standalone**
4. **⚠️ 构建失败时临时禁用 instrumentation.ts**
5. **⚠️ 部署后验证 API 响应**
