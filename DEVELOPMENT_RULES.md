# 开发规范与操作纪律

> 本文档定义了项目的核心开发规范，所有开发人员必须严格遵守。

---

## 📌 核心规矩（4条铁律）

### 1. 分支严格区分，绝对不可搞混

#### 分支定义与用途

| 分支 | 用途 | 保护级别 | 说明 |
|------|------|----------|------|
| `master` | **生产环境** | 🔴 最高 | 仅包含经过测试的稳定代码 |
| `develop` | **开发主分支** | 🟡 中等 | 日常开发集成，测试通过后合并到 master |
| `feature/*` | **功能分支** | 🟢 普通 | 从 develop 创建，开发完成后合并回 develop |

#### 操作规范

```bash
# ✅ 正确：创建功能分支
git checkout develop
git checkout -b feature/your-feature-name

# ✅ 正确：功能完成后合并回 develop
git checkout develop
git merge feature/your-feature-name
git push origin develop

# ✅ 正确：测试稳定后合并到 master
git checkout master
git merge develop
git push origin master

# ❌ 错误：直接在 master 上开发
git checkout master
# 开发新功能...  <-- 绝对禁止！

# ❌ 错误：feature 直接合并到 master
git checkout master
git merge feature/xxx  <-- 必须通过 develop！
```

#### 分支保护规则

- **master 分支**：
  - 禁止直接推送（`git push`）
  - 仅允许通过 `develop` 合并
  - 所有合并需要 Pull Request 审核
  
- **develop 分支**：
  - 功能分支通过 PR 合并
  - 合并前必须在本地测试通过

---

### 2. 每次更新必须上传到 GitHub 对应分支

#### 提交规范

```bash
# 1. 检查状态
git status

# 2. 查看修改内容
git diff

# 3. 添加文件（不要使用 git add . 除非确认）
git add src/app/api/xxx/route.ts
git add src/components/XXX.tsx

# 4. 提交（使用清晰的提交信息）
git commit -m "feat: 添加用户登录功能"
git commit -m "fix: 修复日期解析时区问题"
git commit -m "docs: 更新部署文档"

# 5. 推送到对应分支
git push origin develop      # develop 分支
git push origin feature/xxx  # 功能分支
```

#### 提交信息格式

```
<type>: <description>

# type 类型：
# feat     - 新功能
# fix      - 修复 bug
# docs     - 文档修改
# style    - 代码格式修改（不影响功能）
# refactor - 重构
# test     - 测试相关
# chore    - 构建/工具链相关
```

#### 推送检查清单

- [ ] 代码在本地测试通过
- [ ] 提交信息清晰描述修改内容
- [ ] 推送到正确的分支（master/develop/feature）
- [ ] 确认推送成功（`git push origin <branch>`）

---

### 3. 每次升级必须备份当前数据及用户权限数据

#### 备份脚本（自动化）

```bash
#!/bin/bash
# backup-before-upgrade.sh
# 升级前自动备份数据库和用户权限

BACKUP_DIR="/var/www/my-app/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 1. 备份数据库
echo "📦 备份数据库..."
sudo cp /var/www/my-app/dev.db $BACKUP_DIR/dev.db.$TIMESTAMP.backup
echo "✅ 数据库备份完成: dev.db.$TIMESTAMP.backup"

# 2. 备份用户权限数据（User 表）
echo "📦 备份用户权限数据..."
sqlite3 /var/www/my-app/dev.db ".dump User" > $BACKUP_DIR/users.$TIMESTAMP.sql
echo "✅ 用户权限备份完成: users.$TIMESTAMP.sql"

# 3. 备份当前代码版本
echo "📦 备份代码版本..."
cd /var/www/my-app
git log --oneline -1 > $BACKUP_DIR/git-version.$TIMESTAMP.txt
echo "✅ 代码版本备份完成"

# 4. 显示备份文件列表
echo ""
echo "📋 备份文件列表:"
ls -lh $BACKUP_DIR/*.$TIMESTAMP.*

echo ""
echo "✅ 备份完成！可以安全升级。"
```

#### 升级前检查清单

- [ ] **执行备份脚本**：`sudo bash backup-before-upgrade.sh`
- [ ] **确认备份文件存在**：检查 `backups/` 目录
- [ ] **记录当前版本**：`git log --oneline -1`
- [ ] **通知相关人员**：即将进行升级操作

#### 回滚流程（如果升级失败）

```bash
# 1. 停止服务
sudo pm2 stop smxgc-vibe

# 2. 恢复数据库
sudo cp /var/www/my-app/backups/dev.db.20261021_163000.backup /var/www/my-app/dev.db

# 3. 恢复代码版本
cd /var/www/my-app
sudo git reset --hard <旧版本commit>

# 4. 重启服务
sudo pm2 start smxgc-vibe
```

---

### 4. 测试环境与生产环境严格隔离

#### 环境定义

| 环境 | 用途 | 服务器 | 数据库 | 代码分支 |
|------|------|--------|--------|----------|
| **生产环境** | 真实用户使用 | 122.51.51.46 | `/var/www/my-app/dev.db` | `master` |
| **测试环境** | 功能测试验证 | 122.51.51.46 | `/var/www/my-app-test/dev.db` | `develop`/`feature` |

#### 操作规范

**✅ 允许的操作（测试环境）：**
```bash
# 在测试环境可以：
cd /var/www/my-app-test

# - 测试新功能
# - 导入测试数据
# - 修改配置
# - 清理数据重新测试
```

**❌ 禁止的操作（生产环境）：**
```bash
# 在生产环境绝对禁止：
cd /var/www/my-app

# - ❌ 导入测试数据
# - ❌ 执行删除操作（DELETE/DROP）
# - ❌ 修改数据库结构（ALTER TABLE）
# - ❌ 清理数据
# - ❌ 随意重启服务
```

#### PM2 配置规范

**生产环境 (`/var/www/my-app/ecosystem.config.js`)：**
```javascript
module.exports = {
  apps: [{
    name: 'smxgc-vibe',
    script: '.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'file:/var/www/my-app/dev.db',  // ⚠️ 生产数据库
      ADMIN_PASSWORD: 'habtot-mevxop-5Qekbu'
    },
    instances: 1,
    exec_mode: 'fork',
  }]
};
```

**测试环境 (`/var/www/my-app-test/ecosystem.config.js`)：**
```javascript
module.exports = {
  apps: [{
    name: 'smxgc-vibe-test',
    script: '.next/standalone/server.js',
    env: {
      NODE_ENV: 'test',
      PORT: 3001,
      DATABASE_URL: 'file:/var/www/my-app-test/dev.db',  // ✅ 测试数据库
      ADMIN_PASSWORD: 'test-password'
    },
    instances: 1,
    exec_mode: 'fork',
  }]
};
```

#### 操作前检查清单

**任何服务器操作前必须确认：**
- [ ] 当前在哪个目录？（`pwd`）
- [ ] 操作的是哪个数据库？（检查 `DATABASE_URL`）
- [ ] 这个操作会影响生产数据吗？
- [ ] 是否已经备份？
- [ ] 是否有回滚方案？

---

## 🛡️ 自动化防护脚本

### 生产环境保护脚本

创建文件：`/var/www/my-app/scripts/protect-production.sh`

```bash
#!/bin/bash
# 生产环境保护检查脚本

echo "🛡️ 生产环境保护检查"
echo "==================="

# 1. 检查当前目录
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" == *"/var/www/my-app-test"* ]]; then
    echo "✅ 当前在测试环境，可以操作"
    exit 0
fi

if [[ "$CURRENT_DIR" != *"/var/www/my-app"* ]]; then
    echo "❌ 不在项目目录"
    exit 1
fi

# 2. 检查数据库路径
DB_URL=$(grep DATABASE_URL ecosystem.config.js | grep -o "file:[^']*")
echo "📍 数据库路径: $DB_URL"

# 3. 警告信息
echo ""
echo "⚠️  警告：当前在生产环境！"
echo "   目录: $CURRENT_DIR"
echo "   数据库: $DB_URL"
echo ""
echo "以下操作需要特别谨慎："
echo "  - 导入数据 (Excel 导入)"
echo "  - 删除数据 (DELETE/DROP)"
echo "  - 修改表结构 (ALTER TABLE)"
echo "  - 重启服务 (pm2 restart)"
echo ""

# 4. 要求确认
read -p "确认要继续操作吗？(yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "❌ 操作已取消"
    exit 1
fi

echo "✅ 已确认，可以继续操作"
```

### 使用方法

```bash
# 在执行任何危险操作前运行
source /var/www/my-app/scripts/protect-production.sh
```

---

## 📚 相关文档

- [分支管理详细规范](#) (待补充)
- [数据库备份与恢复指南](#) (待补充)
- [部署流程规范](#) (待补充)

---

## ⚠️ 违反规范的后果

1. **分支混用** → 可能导致生产环境代码不稳定，影响用户
2. **未推送代码** → 代码丢失风险，多人协作冲突
3. **未备份数据** → 数据丢失无法恢复
4. **测试环境污染生产** → 用户数据被破坏，业务中断

**以上规矩是通过实际故障总结出来的，每一次违反都会导致严重后果！**

---

**最后更新：** 2026-10-21  
**制定原因：** 多次因分支混乱、数据污染、测试环境影响生产环境导致服务故障
