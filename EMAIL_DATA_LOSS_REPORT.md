# 邮件数据丢失报告

**检查日期**: 2026-09-20  
**问题**: 邮箱配置和10000+邮件解析数据丢失  
**状态**: ❌ 数据已丢失

---

## 📊 当前数据库状态

### 邮件相关表（全部为空）

| 表名 | 记录数 | 说明 |
|------|--------|------|
| **EmailConfig** | **0** | **邮箱配置（丢失）** |
| **EmailParseResult** | **0** | **邮件解析结果（丢失）** |
| ParseLog | 0 | 解析日志 |
| ParseTask | 0 | 解析任务 |
| NavData | 0 | 净值数据（空） |

### 有数据的表

| 表名 | 记录数 | 说明 |
|------|--------|------|
| FundProduct | 2,736 | 产品汇总数据 |
| StrategyMapping | ? | 策略映射 |
| StrategyDictionary | ? | 策略字典 |
| 其他新表 | 0 | IndexData, IndexMapping等 |

---

## 🔍 数据丢失原因

### 事件时间线

1. **之前**：
   - 有一个566M的数据库文件 `prisma/dev.db`
   - 包含完整的邮件配置和解析数据
   - 包含10000+邮件解析记录

2. **发现问题时**：
   - Prisma查询返回0条记录
   - 但sqlite3直接查询dev.db有2736条FundProduct记录
   - **原因**：有两个数据库文件，Prisma连接的是空的大文件

3. **修复操作**：
   ```bash
   # 备份空的大文件
   cp prisma/dev.db prisma/dev.db.backup
   
   # 删除空的大文件
   rm prisma/dev.db
   
   # 移动有数据的小文件到prisma目录
   mv dev.db prisma/dev.db
   ```

4. **结果**：
   - ✅ FundProduct数据保留（2736条）
   - ❌ **邮件数据丢失**（因为小文件中没有邮件表）

### 根本原因

**两个数据库文件的表结构不同**：

**小文件（664K）**：
- 只有 FundProduct 表
- 2736条产品数据
- 4个日期

**大文件（566M，已删除）**：
- 包含所有表（EmailConfig, EmailParseResult等）
- 10000+邮件解析记录
- 邮箱配置信息
- 可能还有NavData数据

**我们错误地用小文件替换了大文件！**

---

## 💔 丢失的数据

### 1. 邮箱配置
- 邮箱地址
- IMAP服务器配置
- 登录凭据
- 同步设置

### 2. 邮件解析结果
- **约10000+封邮件的解析记录**
- 解析状态（成功/失败）
- 解析时间
- 邮件UID
- 邮件主题等

### 3. 可能的净值数据
- NavData表（如果之前有数据的话）
- 每日产品净值
- 净值日期

---

## 🔧 恢复方案

### 方案1: 检查Time Machine备份（推荐）⭐

**如果Mac开启了Time Machine**：

```bash
# 进入Time Machine
# 导航到：/Users/Admin/Documents/smxgc-vibe/prisma/
# 查找昨天的dev.db文件（566M的那个）
# 恢复该文件
```

**检查Time Machine**：
1. 点击菜单栏的Time Machine图标
2. 选择"浏览Time Machine备份"
3. 导航到项目目录
4. 查找大文件（566M左右）
5. 恢复该文件

### 方案2: 检查Git LFS或其他备份

如果数据库文件曾被提交到Git（使用LFS）：
```bash
git log --all --full-history -- "prisma/dev.db"
git show <commit>:prisma/dev.db > prisma/dev.db.recovered
```

### 方案3: 重新配置和解析

**如果无法恢复备份**：

#### 步骤1: 重新配置邮箱
1. 访问管理后台 `/admin/operation`
2. 添加邮箱配置
3. 配置IMAP服务器

#### 步骤2: 重新解析邮件
1. 运行邮件解析任务
2. 解析历史邮件（可能需要几天时间）
3. 导入NavData表

#### 步骤3: 导入净值数据
1. 如果有Excel文件，批量导入
2. 补充缺失的净值数据

---

## 📋 立即行动

### 检查Time Machine

**请告诉我**：
1. 您的Mac是否开启了Time Machine备份？
2. 备份频率是多少？（每小时/每天）
3. 最近一次备份是什么时候？

**如果开启了Time Machine**：
- 我可以指导您恢复566M的数据库文件
- 数据应该可以完全恢复

### 如果无法恢复

**需要重新配置**：
1. 邮箱配置信息（服务器、账号、密码）
2. 重新运行邮件解析
3. 预计需要1-2天完成历史邮件解析

---

## 💡 未来预防措施

### 1. 定期备份数据库

```bash
# 创建备份脚本 backup-db.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp prisma/dev.db "backups/dev.db.$DATE.bak"
echo "备份完成: dev.db.$DATE.bak"

# 设置cron定时任务（每天凌晨2点）
0 2 * * * cd /Users/Admin/Documents/smxgc-vibe && ./backup-db.sh
```

### 2. 使用Git LFS管理数据库

```bash
git lfs track "*.db"
git add prisma/dev.db
git commit -m "备份数据库"
```

### 3. 导出数据为SQL

```bash
# 导出完整SQL
sqlite3 prisma/dev.db ".dump" > backups/dev_$(date +%Y%m%d).sql

# 恢复
sqlite3 prisma/dev.db < backups/dev_20260920.sql
```

### 4. 分离配置和数据

- 邮箱配置存储在环境变量或.env文件
- 定期导出重要数据为CSV/JSON

---

## ⚠️ 紧急建议

**请立即检查Time Machine！**

时间越久，备份被覆盖的可能性越大。

**检查步骤**：
1. 打开Finder
2. 导航到 `/Users/Admin/Documents/smxgc-vibe/prisma/`
3. 点击菜单栏Time Machine图标
4. 选择"浏览Time Machine备份"
5. 查找566M左右的dev.db文件
6. 如果找到，立即恢复

---

**报告时间**: 2026-09-20  
**紧急程度**: 🔴 高（数据丢失）  
**建议操作**: 立即检查Time Machine备份
