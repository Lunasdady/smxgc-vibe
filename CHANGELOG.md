# 私募星工厂项目 - 变更日志与经验总结

> **项目名称**：私募星工厂管理端  
> **技术栈**：Next.js 14.2.35 + Prisma 5.22.0 + SQLite + PM2  
> **部署模式**：Next.js standalone 输出模式  
> **代码仓库**：https://github.com/Lunasdady/smxgc-vibe  
> **文档创建日期**：2026-07-08  
> **维护者**：开发团队

---

## 📋 目录

- [版本历史](#版本历史)
- [重大 Bug 修复记录](#重大-bug-修复记录)
- [部署经验总结](#部署经验总结)
- [技术决策记录](#技术决策记录)
- [已知问题与解决方案](#已知问题与解决方案)
- [快速参考指南](#快速参考指南)

---

## 版本历史

### v1.0.3 (2026-07-08) - Standalone 部署修复版本

**发布日期**：2026-07-08  
**提交哈希**：`64e71b6`  
**影响范围**：生产环境部署、数据管理

#### 修复内容

1. **API 动态渲染配置**
   - 文件：`src/app/api/data/dates/route.ts`
   - 文件：`src/app/api/admin/status/route.ts`
   - 修改：添加 `export const dynamic = 'force-dynamic'`
   - 原因：Next.js 默认静态缓存导致删除/导入数据后日期列表不更新

2. **管理后台刷新日期列表**
   - 文件：`src/app/admin/page.tsx`
   - 修改：创建模块级 `refreshGlobalDates` 函数
   - 原因：管理端没有 DateSelector 组件，无法使用 `window.refreshDates`

3. **DateSelector 刷新方法优化**
   - 文件：`src/components/DateSelector.tsx`
   - 修改：将 `window.refreshDates` 注册移到 `useEffect` 中
   - 原因：避免每次渲染都重新赋值

#### 相关提交

```
64e71b6 fix: 强制 dates 和 status API 动态渲染，避免静态缓存导致删除后数据不更新
0a06275 fix: 修复管理后台刷新日期列表的作用域问题
1109018 fix: 优化DateSelector刷新方法注册时机
024ae45 fix: 修复管理端删除和导入后日期列表不刷新的问题
```

---

### v1.0.2 (2026-07-01) - 字段版本动态切换

**发布日期**：2026-07-01  
**提交哈希**：待补充  
**影响范围**：策略数据展示、API 查询

#### 功能更新

1. **指增策略字段版本切换**
   - 时间节点：2026-07-08
   - 旧字段：`weeklyReturn`, `monthlyReturn`, `ytdReturn` 等
   - 新字段：`excessReturn1w`, `excessReturn3m`, `excessReturnYtd` 等
   - 原因：指增策略改为展示超额收益数据

2. **套利策略字段适配**
   - 特殊字段：`karmaRatio`（卡玛比率）
   - 其他字段：使用旧字段体系

3. **CTA/期货策略动态映射**
   - 时间节点：2026-07-08
   - 策略类型变更：主观CTA、量化CTA、复合CTA
   - 字段映射：根据日期动态选择

---

### v1.0.1 (2026-06-24) - 初始化版本

**发布日期**：2026-06-24  
**提交哈希**：`b3d4724`  
**影响范围**：项目初始化

#### 基础功能

- ✅ Next.js 14.2.35 项目搭建
- ✅ Prisma + SQLite 数据库配置
- ✅ 策略数据管理后台
- ✅ 前端数据展示页面
- ✅ 箱型图可视化
- ✅ Excel/CSV 数据导入

---

## 重大 Bug 修复记录

### BUG-001: API 静态缓存导致数据不更新

**问题编号**：BUG-001  
**发现日期**：2026-07-08  
**严重程度**：🔴 严重  
**影响范围**：所有数据管理功能

#### 问题描述

- 本地开发环境正常，云端部署后出现问题
- 删除指定日期数据后，前端日期筛选框仍显示已删除的日期
- 导入新数据后，前端日期筛选框中无新日期选项
- 管理后台显示的"最新数据日期"与实际不符

#### 根本原因

1. **Next.js 静态缓存机制**
   - 构建时 API 路由被标记为 `○`（静态生成）
   - API 在构建时执行一次并缓存结果
   - 后续请求直接返回缓存，不查询数据库

2. **Standalone 模式数据库不同步**
   - `.next/standalone/prisma/dev.db` 是构建时的副本
   - 项目根目录数据库和 standalone 数据库是两个独立文件
   - 导入操作写入根目录数据库，查询操作读取 standalone 数据库

3. **Prisma db pull 修改 schema**
   - 执行 `npx prisma db pull` 后修改了 DateTime 字段类型
   - 导致 Prisma Client 序列化/反序列化异常

4. **Git 合并冲突导致代码未更新**
   - `prisma/dev.db` 有本地改动，`git pull` 失败
   - 但部署脚本继续执行，使用旧代码

#### 解决方案

1. **强制 API 动态渲染**
   ```typescript
   // src/app/api/data/dates/route.ts
   export const dynamic = 'force-dynamic';
   ```

2. **使用符号链接统一数据库**
   ```bash
   rm -f .next/standalone/prisma/dev.db
   ln -s /var/www/my-app/prisma/dev.db .next/standalone/prisma/dev.db
   ```

3. **恢复原始 schema**
   ```bash
   git checkout prisma/schema.prisma
   npx prisma generate
   ```

4. **正确的 Git 更新流程**
   ```bash
   git stash
   git pull origin master
   ```

#### 验证方法

构建输出中 API 路由应显示 `ƒ`（动态）而非 `○`（静态）：
```
├ ƒ /api/data/dates                        0 B                0 B    ✅
├ ƒ /api/admin/status                      0 B                0 B    ✅
```

#### 经验教训

- ❌ 永远不要在生产环境执行 `npx prisma db pull`
- ❌ 不要忽略 `git pull` 的错误信息
- ✅ 每次部署前清理缓存：`rm -rf .next node_modules/.cache`
- ✅ 使用绝对路径配置 DATABASE_URL
- ✅ 每次构建后重新创建符号链接

**状态**：✅ 已解决  
**解决日期**：2026-07-08  
**相关文档**：`Next.js_Standalone_部署踩坑经验总结.md`

---

### BUG-002: 指增策略数据查询为空

**问题编号**：BUG-002  
**发现日期**：2026-07-01  
**严重程度**：🟡 中等  
**影响范围**：指增策略数据展示

#### 问题描述

- 日期 >= 2026-07-08 时，指增策略箱型图显示"暂无数据"
- API 返回 count 为 0

#### 根本原因

- 指增策略指标字段已迁移至 `excessReturn` 系列
- API 在未传 metric 参数时，默认使用旧字段 `weeklyReturn`
- 导致查询结果为空

#### 解决方案

通过 `getActualMetric` 函数自动映射字段：
```typescript
const actualMetric = getActualMetric(metric, strategyType, dataDate);
```

**状态**：✅ 已解决

---

### BUG-003: CTA 策略类型映射错误

**问题编号**：BUG-003  
**发现日期**：2026-06-24  
**严重程度**：🟡 中等  
**影响范围**：CTA 策略数据查询

#### 问题描述

- CTA 策略和期货策略的字段映射不一致
- 部分策略类型无法正确查询数据

#### 解决方案

- 建立动态策略类型映射表
- 根据日期和策略类型自动选择正确的字段

**状态**：✅ 已解决

---

## 部署经验总结

### 经验 001: Standalone 模式数据库同步

**问题**：standalone 模式下数据库文件不同步  
**日期**：2026-07-08

**原因**：
- standalone 模式会在构建时复制 `prisma/dev.db` 到 `.next/standalone/prisma/dev.db`
- 两个文件独立，导致数据写入和读取分离

**解决方案**：
```bash
# 每次构建后执行
rm -f .next/standalone/prisma/dev.db
ln -s /var/www/my-app/prisma/dev.db .next/standalone/prisma/dev.db
```

**预防措施**：
- 在部署脚本中自动化此步骤
- 使用绝对路径，避免路径问题

---

### 经验 002: API 静态缓存问题

**问题**：Next.js API 路由被静态缓存  
**日期**：2026-07-08

**原因**：
- Next.js 默认优化：未使用动态特性的 API 会被静态生成
- 静态生成的 API 在构建时执行一次并缓存

**解决方案**：
```typescript
export const dynamic = 'force-dynamic';
```

**预防措施**：
- 所有需要实时查询数据库的 API 都添加此配置
- 构建后检查输出，确认 API 显示为 `ƒ` 而非 `○`

---

### 经验 003: Git 合并冲突处理

**问题**：数据库文件导致 git pull 失败  
**日期**：2026-07-08

**原因**：
- `prisma/dev.db` 经常有本地改动（导入新数据）
- 直接 `git pull` 会因合并冲突失败

**解决方案**：
```bash
git stash          # 暂存本地改动
git pull origin master  # 拉取最新代码
# 如需恢复数据库：git stash pop
```

**预防措施**：
- 在部署脚本中自动化 `git stash`
- 验证代码是否真正更新：`grep -n "force-dynamic" src/app/api/...`

---

### 经验 004: Prisma db pull 的风险

**问题**：`db pull` 修改 schema 导致查询异常  
**日期**：2026-07-08

**原因**：
- `db pull` 会从数据库反向生成 schema
- 可能错误推断字段类型（如 DateTime 的存储格式）

**预防措施**：
- ❌ 永远不要在生产环境直接执行 `npx prisma db pull`
- ✅ 使用 `npx prisma db push` 同步 schema 到数据库
- ✅ 如果 schema 被意外修改，立即 `git checkout` 恢复

---

## 技术决策记录

### 决策 001: 选择 Next.js Standalone 模式

**日期**：2026-06-24  
**决策者**：开发团队  
**状态**：✅ 已实施

**背景**：
- 需要最小化生产环境部署体积
- 简化服务器配置

**方案对比**：
| 方案 | 优点 | 缺点 |
|------|------|------|
| Standalone | 体积小、依赖完整 | 需要手动处理数据库同步 |
| 标准模式 | 简单直接 | 需要安装所有依赖 |

**决策理由**：
- Standalone 模式更适合生产环境
- 通过符号链接可以解决数据库同步问题

**后续影响**：
- 需要在部署脚本中处理符号链接
- 必须使用绝对路径配置 DATABASE_URL

---

### 决策 002: 使用 SQLite 而非 PostgreSQL

**日期**：2026-06-24  
**决策者**：开发团队  
**状态**：✅ 已实施

**背景**：
- 项目规模较小
- 数据量可控

**方案对比**：
| 数据库 | 优点 | 缺点 |
|--------|------|------|
| SQLite | 零配置、单文件、易于备份 | 并发写入有限 |
| PostgreSQL | 高并发、功能强大 | 需要安装配置 |

**决策理由**：
- 当前数据量不大，SQLite 足够
- 简化部署流程
- 文件数据库易于备份和迁移

**后续影响**：
- 需要注意 standalone 模式的数据库同步问题
- 高并发场景可能需要升级到 PostgreSQL

---

### 决策 003: 指增策略字段版本切换

**日期**：2026-07-01  
**决策者**：业务需求  
**状态**：✅ 已实施

**背景**：
- 2026-07-08 起，指增策略改为展示超额收益数据
- 需要兼容新旧两种字段体系

**技术方案**：
- 根据数据日期动态选择字段映射
- 使用 `getActualMetric` 函数自动适配

**实现细节**：
```typescript
const cutoffDate = new Date('2026-07-08');
const isNewFields = date >= cutoffDate;

if (isNewFields && isIndexEnhanced) {
  // 使用 excessReturn 系列字段
} else {
  // 使用传统字段
}
```

**后续影响**：
- API 需要传递 dataDate 参数
- 前端需要处理字段版本差异

---

## 已知问题与解决方案

### 问题 001: PM2 启动路径错误

**描述**：使用 `next start` 启动 standalone 服务导致静态资源 404  
**解决方案**：
```bash
# 错误
pm2 start npm -- start

# 正确
pm2 start .next/standalone/server.js --name "smxgc-vibe"
```

**状态**：✅ 已解决并记录

---

### 问题 002: 端口被旧进程占用

**描述**：开发服务器启动时，旧进程仍在运行占用 3000/3001 端口  
**解决方案**：
```bash
# 查找占用进程
Get-NetTCPConnection -LocalPort 3000,3001

# 终止进程
Stop-Process -Id <PID> -Force
```

**状态**：✅ 已解决

---

### 问题 003: 开发服务器缓存导致 404

**描述**：`.next/cache` 缓存旧模块导致找不到文件  
**解决方案**：
```bash
rm -rf .next
npm run dev
```

**状态**：✅ 已解决

---

## 快速参考指南

### 标准部署流程

```bash
cd /var/www/my-app

# 1. 停止服务
pm2 delete smxgc-vibe

# 2. 暂存本地数据库改动
git stash

# 3. 拉取最新代码
git pull origin master

# 4. 验证关键配置
grep -n "force-dynamic" src/app/api/data/dates/route.ts

# 5. 完全清理缓存
rm -rf .next node_modules/.cache

# 6. 重新构建
npm run build

# 7. 复制资源
cp -r .next/static .next/standalone/.next/
cp .env .next/standalone/.env

# 8. 重新创建符号链接
rm -f .next/standalone/prisma/dev.db
ln -s /var/www/my-app/prisma/dev.db .next/standalone/prisma/dev.db

# 9. 启动服务
pm2 start .next/standalone/server.js --name "smxgc-vibe"
pm2 save

# 10. 验证服务
sleep 5
curl -s "http://localhost:3000/api/data/dates" | python3 -m json.tool
```

### 问题排查检查清单

#### 数据不更新问题
- [ ] API 路由是否包含 `export const dynamic = 'force-dynamic'`
- [ ] 构建输出中 API 路由是否显示 `ƒ` 而非 `○`
- [ ] 是否清理了 `.next` 和 `node_modules/.cache` 缓存
- [ ] 代码是否真正更新（检查 `git log` 和 `git status`）

#### 数据库读写不一致
- [ ] 是否存在多个 `dev.db` 文件
- [ ] 符号链接是否正确
- [ ] `.env` 中的 DATABASE_URL 是否使用绝对路径
- [ ] 项目根目录和 standalone 目录的 `.env` 是否一致

#### 数据查询异常
- [ ] `prisma/schema.prisma` 是否被意外修改
- [ ] 是否执行过 `npx prisma db pull`
- [ ] Prisma Client 是否重新生成
- [ ] 数据库表结构是否正确

### 常用命令速查

```bash
# 查看数据库中的日期
sqlite3 prisma/dev.db "SELECT DISTINCT dataDate FROM FundProduct ORDER BY dataDate DESC;"

# 查看日期对应的可读时间
sqlite3 prisma/dev.db "SELECT dataDate, datetime(dataDate/1000, 'unixepoch') FROM FundProduct ORDER BY dataDate DESC;"

# 查看数据库表结构
sqlite3 prisma/dev.db "PRAGMA table_info(FundProduct);"

# 检查符号链接
ls -la .next/standalone/prisma/dev.db

# 查看 PM2 日志
pm2 logs smxgc-vibe --lines 50

# 查看构建输出中的 API 路由类型
npm run build 2>&1 | grep -E "api/data/dates|api/admin/status"
```

---

## 附录

### A. 项目文件结构

```
smxgc-vibe/
├── src/
│   ├── app/
│   │   ├── admin/              # 管理后台
│   │   ├── api/                # API 路由
│   │   │   ├── admin/          # 管理 API
│   │   │   ├── data/           # 数据 API
│   │   │   └── strategies/     # 策略 API
│   │   ├── strategy/[type]/    # 策略详情页
│   │   └── page.tsx            # 首页
│   ├── components/             # 组件
│   └── lib/                    # 工具库
│       ├── db.ts               # 数据库连接
│       ├── store.ts            # 状态管理
│       ├── types.ts            # 类型定义
│       └── stats.ts            # 统计函数
├── prisma/
│   ├── schema.prisma           # 数据模型
│   └── dev.db                  # SQLite 数据库
├── .next/                      # 构建输出
├── .env                        # 环境变量
├── next.config.js              # Next.js 配置
└── package.json                # 项目依赖
```

### B. 关键文件说明

| 文件 | 用途 | 注意事项 |
|------|------|---------|
| `src/app/api/data/dates/route.ts` | 获取日期列表 API | 必须包含 `force-dynamic` |
| `src/app/api/admin/status/route.ts` | 管理后台状态 API | 必须包含 `force-dynamic` |
| `src/app/admin/page.tsx` | 管理后台页面 | 包含 `refreshGlobalDates` 函数 |
| `src/components/DateSelector.tsx` | 日期选择器组件 | 暴露 `window.refreshDates` |
| `prisma/schema.prisma` | 数据模型定义 | 不要在生产环境修改 |
| `.next/standalone/prisma/dev.db` | standalone 数据库 | 必须是符号链接 |

### C. 环境变量配置

```env
DATABASE_URL="file:/var/www/my-app/prisma/dev.db"
ADMIN_PASSWORD="your-admin-password"
JWT_SECRET="your-jwt-secret"
```

**注意事项**：
- DATABASE_URL 必须使用绝对路径
- `.env` 文件需要在构建前创建
- standalone 模式需要复制 `.env` 到 `.next/standalone/.env`

---

## 变更记录

| 日期 | 版本 | 变更内容 | 操作人 |
|------|------|---------|--------|
| 2026-07-08 | v1.0.3 | 创建文档，记录 BUG-001 修复过程 | AI Assistant |
| 2026-07-01 | v1.0.2 | 字段版本动态切换功能 | 开发团队 |
| 2026-06-24 | v1.0.1 | 项目初始化 | 开发团队 |

---

## 总结

本文档记录了项目从初始化到现在的所有重大变更、Bug 修复和技术决策。通过这份文档，可以：

1. **快速定位问题**：遇到类似问题时查阅相关记录
2. **避免重复踩坑**：了解历史问题和解决方案
3. **理解决策背景**：明白为什么采用某些技术方案
4. **新成员上手**：快速了解项目历史和技术债务

**维护建议**：
- 每次重大变更后及时更新本文档
- 记录问题现象、原因、解决方案和验证方法
- 保留关键代码片段和命令示例
- 定期回顾和整理文档内容

---

**文档版本**：v1.0  
**最后更新**：2026-07-08  
**下次更新**：待定  
**文档状态**：✅ 活跃维护中
