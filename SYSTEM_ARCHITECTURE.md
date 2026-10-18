# 私募星工厂系统 - 完整系统逻辑与架构

## 📊 系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端展示层 (UI)                          │
├─────────────────────────────────────────────────────────────────┤
│  概况页面  │  策略详情页  │  产品明细  │  管理后台  │  用户认证  │
└─────────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                       API 路由层 (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  策略数据API  │  产品明细API  │  管理API  │  邮件解析API  │  认证API │
└─────────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                      业务逻辑层 (Lib)                           │
├─────────────────────────────────────────────────────────────────┤
│  指标计算器  │  策略类型工具  │  邮件解析引擎  │  认证中间件  │
└─────────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                        数据层 (SQLite)                          │
├─────────────────────────────────────────────────────────────────┤
│  FundProduct  │  NavData  │  StrategyMapping  │  User  │  Email  │
└─────────────────────────────────────────────────────────────────┘
```

## 🗄️ 核心数据模型

### 1. FundProduct（基金产品指标表）
**用途**：存储每个产品在不同日期的收益指标数据

**关键字段**：
- `productCode`: 产品代码（唯一标识）
- `dataDate`: 数据日期（毫秒时间戳）
- `strategyType`: 策略类型（如 index-enhanced-300）
- 收益指标：weeklyReturn, monthlyReturn, ytdReturn 等
- 超额指标：excessReturn1w, excessReturn3m 等（仅指增策略）

**唯一约束**：`[productCode, dataDate]`

**数据特点**：
- 按周五日期存储（每周一条记录）
- 数据通过邮件解析后自动计算生成
- 策略变更时自动重新计算

### 2. NavData（净值数据表）
**用途**：存储从邮件解析的原始净值数据

**关键字段**：
- `productCode`: 产品代码
- `productName`: 产品名称
- `navDate`: 净值日期
- `unitNav`: 单位净值
- `cumulativeNav`: 累计净值
- `source`: 数据来源（html/excel/vertical）

**唯一约束**：`[productCode, navDate]`

**数据来源**：邮件解析系统自动导入

### 3. StrategyMapping（策略映射表）
**用途**：维护产品与策略的映射关系

**关键字段**：
- `productCode`: 产品代码（唯一）
- `primaryStrategy`: 一级策略
- `secondaryStrategy`: 二级策略
- `category`: 分类分层（观察池等）
- `fundManager`: 基金管理人
- `managerScale`: 管理人规模

**唯一约束**：`[productCode]`

**更新方式**：管理端策略维护页面手动维护

### 4. IndexData（指数数据表）
**用途**：存储基准指数数据（用于超额收益计算）

**关键字段**：
- `indexCode`: 指数代码（如 000300.SH）
- `tradeDate`: 交易日期
- `closePrice`: 收盘价
- `dailyReturn`: 日收益率

**唯一约束**：`[indexCode, tradeDate]`

### 5. IndexMapping（策略-指数映射表）
**用途**：映射策略类型与基准指数

**关键字段**：
- `secondaryStrategy`: 二级策略名称（唯一）
- `indexCode`: 基准指数代码
- `indexName`: 基准指数名称

### 6. User（用户表）
**用途**：用户认证和权限管理

**关键字段**：
- `email`: 邮箱（唯一）
- `password`: bcrypt 加密密码
- `permissions`: JSON 权限数组
- `status`: pending/approved/rejected

## 🔄 核心业务流程

### 流程 1：邮件解析 → 指标计算

```
邮件服务器
    ↓ (定时任务：每天 9/11/13/15/17/20 点)
邮件解析引擎 (scheduler.ts)
    ├─ 连接 IMAP 服务器
    ├─ 读取未读邮件
    ├─ 解析 HTML/Excel 附件
    └─ 提取净值数据
    ↓
NavData 表
    ├─ 存储原始净值数据
    └─ 去重（productCode + navDate）
    ↓ (触发)
指标计算器 (metrics-calculator.ts)
    ├─ 读取近6个月净值数据
    ├─ 计算收益指标（周/月/年/最大回撤等）
    ├─ 计算超额收益（对比基准指数）
    └─ 写入 FundProduct 表
    ↓
FundProduct 表
    └─ 按周五日期存储计算结果
```

**触发时机**：
1. 邮件解析完成后自动触发
2. 策略维护更新时手动触发
3. 批量计算 API 手动触发

### 流程 2：策略维护 → 策略联动

```
管理端策略维护页面
    ↓ (用户修改策略)
POST /api/admin/strategy-maintenance/update
    ├─ 更新 StrategyMapping 表
    ├─ 合并新旧值（不覆盖空字段）
    └─ 获取最新策略配置
    ↓
getStrategyType() 函数
    ├─ 根据一级+二级策略判断策略类型
    └─ 返回策略标识（如 index-enhanced-300）
    ↓
同步更新 FundProduct 表
    ├─ UPDATE FundProduct SET strategyType = ?
    └─ WHERE productCode = ?
    ↓
recalculateProductMetrics() 函数
    ├─ 查询产品所有历史周五净值
    ├─ 逐个日期重新计算指标
    └─ 写入/更新 FundProduct 表
    ↓
前端自动刷新
    └─ 显示最新策略配置
```

**关键特性**：
- 策略变更后，产品自动移到对应策略分类
- 历史数据自动重新计算
- 前端实时显示最新状态

### 流程 3：产品明细查询

```
前端产品明细页面
    ↓ (访问 /strategy/[type]/products)
GET /api/strategies/[type]/products
    ├─ 检查权限（strategy-detail）
    ├─ 确定查询日期
    │   ├─ 如果未指定：使用该策略类型最新日期
    │   └─ 如果指定：使用指定日期
    ├─ 策略类型映射（CTA ↔ 期货历史映射）
    └─ 查询 FundProduct 表
    ↓
返回产品列表
    ├─ 分页数据
    ├─ 策略分类（从 StrategyMapping 读取）
    ├─ 收益指标
    └─ 超额指标（指增策略）
    ↓
前端展示
    ├─ 表格展示
    ├─ 箱型图
    └─ 走势浮窗
```

**日期选择逻辑**：
- 默认：该策略类型下最新日期
- 筛选器：仅显示有数据的周五
- 兼容：历史期货策略数据

### 流程 4：用户认证与权限

```
用户登录/注册
    ↓
POST /api/auth/login 或 /register
    ├─ 验证邮箱/密码
    ├─ 生成 JWT Token
    └─ 返回用户信息
    ↓
前端存储 Token
    └─ localStorage
    ↓
后续请求
    ├─ 携带 Authorization Header
    └─ verifyRequestAuth() 验证
    ↓
权限检查
    ├─ hasPermission(auth, 'strategy-detail')
    └─ 返回 403 或允许访问
```

**权限类型**：
- `strategy-detail`: 查看策略详情
- `admin`: 管理后台访问

## 🔧 关键工具函数

### getStrategyType()
**位置**：`src/lib/strategy-type-utils.ts`

**功能**：根据一级和二级策略名称，自动判断策略类型

**规则**：
```
指增 + 300 → index-enhanced-300
指增 + 500 → index-enhanced-500
指增 + 1000 → index-enhanced-1000
指增 + 2000 → index-enhanced-2000
指增 + A500/红利/另类 → index-enhanced-alternative
主观多头 → subjective-long
量化选股 → quantitative-stock-selection
CTA + 主观 → subjective-cta
CTA + 量化 → quantitative-cta
...
```

### calculateAllMetrics()
**位置**：`src/lib/metrics-calculator.ts`

**功能**：计算产品所有收益指标

**输入**：近6个月净值数据 + 目标日期
**输出**：
- 基础指标：weeklyReturn, monthlyReturn, ytdReturn, annualizedReturnSinceInception
- 风险指标：ytdMaxDrawdown, inceptionMaxDrawdown, annualizedVolatility, sharpeRatio
- 超额指标（指增策略）：excessReturn1w, excessReturn3m, excessSharpeRatio 等

## 📁 目录结构

```
src/
├── app/
│   ├── api/
│   │   ├── strategies/[type]/          # 策略数据 API
│   │   │   ├── products/route.ts       # 产品明细
│   │   │   ├── group-summary/route.ts  # 分组汇总
│   │   │   └── weekly-details/route.ts # 周度明细
│   │   ├── admin/                       # 管理端 API
│   │   │   ├── strategy-maintenance/   # 策略维护
│   │   │   │   ├── products/route.ts   # 产品列表
│   │   │   │   ├── update/route.ts     # 更新策略
│   │   │   │   ├── export/route.ts     # 导出Excel
│   │   │   │   └── import/route.ts     # 导入Excel
│   │   │   └── email/                  # 邮件管理
│   │   │       ├── parse/route.ts      # 解析邮件
│   │   │       └── configs/route.ts    # 邮箱配置
│   │   ├── auth/                        # 认证 API
│   │   └── strategy/
│   │       └── calculate-metrics/      # 指标计算 API
│   │           └── route.ts
│   ├── strategy/[type]/                # 策略详情页
│   └── admin/                          # 管理后台
│       └── strategy-maintenance/       # 策略维护页
├── lib/
│   ├── metrics-calculator.ts           # 指标计算核心逻辑
│   ├── strategy-type-utils.ts          # 策略类型判断
│   ├── email-parser/                   # 邮件解析引擎
│   │   ├── engine.ts                   # 解析引擎
│   │   ├── scheduler.ts                # 定时任务
│   │   └── rules.ts                    # 解析规则
│   ├── auth.ts                         # 认证中间件
│   └── db.ts                           # Prisma 客户端
└── components/
    ├── BoxPlot.tsx                     # 箱型图组件
    ├── MetricSelector.tsx              # 指标选择器
    └── WeeklyDetailTable.tsx           # 周度明细表
```

## ⚠️ 重要设计决策

### 1. 数据存储格式
- **FundProduct.dataDate**: 毫秒时间戳（整数），非日期字符串
- **NavData.navDate**: JavaScript Date 对象（SQLite 自动转换）
- **原因**：便于时间范围查询和计算

### 2. 策略类型存储
- **StrategyMapping**: 存储一级/二级策略（人类可读）
- **FundProduct.strategyType**: 存储策略标识（程序使用）
- **同步机制**：策略变更时自动同步

### 3. 指标计算时机
- **自动触发**：邮件解析完成后
- **手动触发**：策略维护更新时
- **批量触发**：调用 calculate-metrics API

### 4. 日期选择策略
- **产品明细**：默认使用该策略类型最新日期（非全局最新）
- **日期筛选器**：仅显示有数据的周五
- **历史兼容**：CTA/期货策略按日期自动映射

### 5. 权限控制
- **JWT Token**：存储在 localStorage
- **API 验证**：每个请求验证 Token 和权限
- **前端路由**：无权访问返回 403

## 🚨 潜在问题与注意事项

### 问题 1：新维护策略的产品无历史数据
**现象**：产品之前未维护策略，FundProduct 表无数据
**解决**：策略维护更新时自动重新计算所有历史周五数据 ✅ 已修复

### 问题 2：策略变更后产品明细不显示
**现象**：修改策略后，产品未出现在新策略分类下
**解决**：更新 StrategyMapping 时同步更新 FundProduct.strategyType ✅ 已修复

### 问题 3：日期不匹配导致产品不显示
**现象**：产品最新日期早于全局最新日期
**解决**：产品明细默认使用该策略类型最新日期 ✅ 已修复

### 问题 4：策略字段被覆盖为空
**现象**：只更新一级策略时，二级策略被清空
**解决**：合并新旧值，未传字段保留原值 ✅ 已修复

### 注意事项
1. **FundProduct 只存周五数据**：其他日期不计算
2. **指标计算需要6个月历史净值**：不足2条数据跳过
3. **超额指标仅指增策略**：其他策略不计算
4. **邮件解析增量更新**：根据 lastParsedUid 避免重复
5. **数据库迁移需谨慎**：避免清空现有数据

## 📈 数据流向图

```
邮件服务器
    ↓ IMAP
邮件解析引擎 (定时任务)
    ↓
NavData 表 (原始净值)
    ↓ 触发计算
指标计算器
    ├─ 读取 IndexData (基准指数)
    ├─ 读取 IndexMapping (策略-指数映射)
    └─ 读取 StrategyMapping (策略类型)
    ↓
FundProduct 表 (计算指标)
    ↓
产品明细 API
    ↓
前端展示 (表格/箱型图/走势)
    ↓
用户交互 (策略维护)
    ↓
StrategyMapping 表 (策略配置)
    ↓ 触发同步
FundProduct 表 (更新 strategyType)
    ↓ 重新计算
指标计算器 → FundProduct 表
```

## 🔐 安全机制

1. **密码加密**：bcrypt hash
2. **SMTP密码**：AES 加密存储
3. **JWT Token**：过期时间 + 刷新机制
4. **权限验证**：每个 API 检查权限
5. **数据库文件**：权限 600（仅 root 可读写）

---

**文档版本**：v1.0
**最后更新**：2026-10-09
**维护者**：系统自动生成
