# 开发规范与操作纪律

> 本文档定义了项目的核心开发规范，所有开发人员（包括AI）必须严格遵守。
> 
> **最后更新：** 2026-10-22

---

## 📌 核心规矩（5条铁律）

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

---

### 2. 每次更新必须上传到 GitHub 对应分支

#### 提交规范

```bash
# 1. 检查状态
git status

# 2. 查看修改内容
git diff

# 3. 添加文件
git add src/app/api/xxx/route.ts

# 4. 提交（使用清晰的提交信息）
git commit -m "feat: 添加用户登录功能"

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

---

### 3. ⚠️ 本地开发完成后必须询问用户才能同步到 GitHub

#### 严格禁止的操作

```bash
# ❌ 绝对禁止：未经用户同意自动推送
git push origin master
git push origin develop
git push origin feature/*
```

#### 正确流程

```
1. 在本地完成开发
2. 本地测试通过
3. ⚠️ 询问用户："本地开发完成，是否同步到 GitHub？"
4. 等待用户确认
5. 用户确认后执行 git push
```

#### AI 操作规范

**每次本地开发测试通过后，必须：**
1. 告知用户修改内容
2. 告知用户测试通过
3. **询问：** "是否同步到 GitHub 的 [分支名] 分支？"
4. **等待用户明确回复**
5. 仅在用户明确同意后执行推送

**禁止行为：**
- ❌ 自动执行 `git push`
- ❌ 假设用户同意推送
- ❌ 跳过询问步骤

---

### 4. 每次升级必须备份当前数据及用户权限数据

#### 升级前检查清单

- [ ] **执行备份脚本**：`sudo bash scripts/backup-before-upgrade.sh`
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

### 5. 测试环境与生产环境严格隔离

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

---

## ⚠️ 违反规范的后果

1. **分支混用** → 可能导致生产环境代码不稳定，影响用户
2. **未经同意推送代码** → 可能推送未完成的代码，影响团队协作
3. **未备份数据** → 数据丢失无法恢复
4. **测试环境污染生产** → 用户数据被破坏，业务中断

**以上规矩是通过实际故障总结出来的，每一次违反都会导致严重后果！**

---

## 📝 修订历史

| 日期 | 修订内容 | 修订人 |
|------|----------|--------|
| 2026-10-21 | 初始版本，制定4条铁律 | AI + 用户 |
| 2026-10-22 | 添加第5条铁律：本地开发完成后必须询问用户才能同步到GitHub | 用户要求 |

---

**最后提醒：规矩是血的教训，必须严格遵守！**
