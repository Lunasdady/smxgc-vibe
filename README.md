# 私募基金策略业绩数据展板

## 项目概述

本项目是一套 **私募基金分策略业绩跟踪数据展板**，包含对外展示的前端数据看板与后端数据管理平台。系统通过导入按照规范命名的 Excel 文件，解析并存储数据，前端以箱型图、明细表格等形式呈现策略收益统计，支持历史数据回溯。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS
- **图表**: 纯 SVG 实现箱型图（支持均值点标记）
- **Excel 解析**: xlsx (SheetJS)
- **数据库 ORM**: Prisma + SQLite
- **日期处理**: dayjs
- **全局状态**: zustand
- **鉴权**: JWT (jsonwebtoken)

## 功能特性

### 前端数据看板

#### 1. 全局日期选择器
- 所有页面顶部固定显示数据日期选择器
- 提供所有历史导入日期的下拉列表（倒序排列）
- 默认选中最新数据日期
- 切换日期后所有数据图表立即更新

#### 2. 首页（汇总统计）
- **全部策略收益分布箱型图**
  - 展示 15 个策略的近一周收益五数统计（最小值、Q25、均值、Q75、最大值）
  - 箱型图卡片网格布局，清晰显示箱体、须线、均值点
  - 无数据时显示"暂无数据"占位

- **点击联动明细表**
  - 点击箱型图卡片展开该策略的近一周收益明细列表
  - 支持按收益升序/降序排序

#### 3. 策略详情页
- **按规模分组的收益箱型图**
  - 100 亿元以上组 vs 100 亿以下组对比
  - 显示各组产品数量和五数统计

- **产品完整数据明细表**
  - 展示所有产品完整字段（收益、回撤、波动率、夏普比率等）
  - 支持表头排序（升序/降序）
  - 支持按基金管理人关键字搜索
  - 数据分页（每页 20 条）
  - 移动端横向滚动

### 后端数据管理平台

#### 1. Excel 上传与预览
- 支持拖拽或点击选择 `.xlsx` 文件
- 自动从文件名提取数据日期（正则匹配 8 位数字）
- 解析所有 Sheet，返回预览信息

#### 2. 数据导入与历史管理
- **追加模式**：每次导入不删除已有数据
- **冲突处理**：
  - 跳过（保留原有数据）
  - 覆盖（删除旧数据后重新导入）
- **批次管理**：
  - 查看所有导入批次
  - 按日期删除批次
  - 清空全部数据

## 项目结构

```
smxgc-vibe/
├── src/
│   ├── app/
│   │   ├── api/              # API 路由
│   │   │   ├── admin/        # 管理后台 API
│   │   │   ├── data/         # 数据日期 API
│   │   │   └── strategies/   # 策略数据 API
│   │   ├── admin/            # 管理后台页面
│   │   ├── strategy/[type]/  # 策略详情页
│   │   ├── globals.css       # 全局样式
│   │   ├── layout.tsx        # 根布局
│   │   └── page.tsx          # 首页
│   ├── components/           # React 组件
│   │   ├── BoxPlot.tsx       # 箱型图组件
│   │   ├── DateSelector.tsx  # 日期选择器
│   │   ├── Sidebar.tsx       # 侧边栏导航
│   │   └── WeeklyDetailTable.tsx
│   └── lib/                  # 工具库
│       ├── db.ts             # Prisma 客户端
│       ├── stats.ts          # 统计计算
│       ├── store.ts          # 全局状态
│       └── types.ts          # 类型定义
├── prisma/
│   └── schema.prisma         # 数据库模型
├── .env                      # 环境变量
├── next.config.js            # Next.js 配置
├── tailwind.config.ts        # Tailwind CSS 配置
└── tsconfig.json             # TypeScript 配置
```

## 快速开始

### 环境要求

- Node.js >= 18.0
- npm >= 9.0

### 安装依赖

```bash
npm install
```

### 配置数据库

1. 确保 `.env` 文件中配置了数据库连接字符串：
   ```env
   DATABASE_URL="file:./dev.db"
   ADMIN_PASSWORD="admin123456"
   JWT_SECRET="your-secret-key-change-in-production"
   ```

2. 推送数据库 Schema：
   ```bash
   npm run db:push
   ```

3. 生成 Prisma 客户端：
   ```bash
   npm run db:generate
   ```

### 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 生产构建

```bash
npm run build
npm start
```

## 数据源规范

### Excel 文件结构
- 每个 **Sheet 页** 代表一个策略类型，Sheet 名称即策略名称
- 所有 Sheet 的**表头完全一致**

### 文件命名规范
```
私募星工厂全量私募业绩跟踪_yyyymmdd.xlsx
```
例如：`私募星工厂全量私募业绩跟踪_20260612.xlsx`

文件名中的 `yyyymmdd`（8位数字）代表数据日期。

### 策略类型清单（15个）

| 序号 | 策略名称 | strategyType |
|------|----------|--------------|
| 1 | 主观多头 | subjective-long |
| 2 | 300指增 | index-enhanced-300 |
| 3 | 500指增 | index-enhanced-500 |
| 4 | 1000指增 | index-enhanced-1000 |
| 5 | 2000指增 | index-enhanced-2000 |
| 6 | 另类指增 | index-enhanced-alternative |
| 7 | 量化选股 | quantitative-stock-selection |
| 8 | 择时&多空 | timing-long-short |
| 9 | 市场中性&T0 | market-neutral-t0 |
| 10 | 可转债多头 | convertible-bond-long |
| 11 | 主观期货 | subjective-futures |
| 12 | 量化期货 | quantitative-futures |
| 13 | 套利策略 | arbitrage |
| 14 | 宏观策略 | macro-strategy |
| 15 | 复核策略 | composite-strategy |

## 导航菜单结构

- 首页
- 指增策略
  - 300指增
  - 500指增
  - 1000指增
  - 2000指增
  - 另类指增
- 主观多头
- 量化选股
- 择时&多空
- 市场中性&T0
- 可转债多头
- 期货策略
  - 主观期货
  - 量化期货
- 套利策略
- 宏观策略
- 复核策略

## API 端点

### 前端数据 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/strategies/overview` | GET | 返回所有策略的五数统计 |
| `/api/strategies/[type]/products` | GET | 返回指定策略的产品明细 |
| `/api/strategies/[type]/group-summary` | GET | 返回按规模分组的统计 |
| `/api/strategies/[type]/weekly-details` | GET | 返回近一周收益明细 |
| `/api/data/dates` | GET | 返回所有历史数据日期 |
| `/api/data/latest-date` | GET | 返回最新数据日期 |

### 后端管理 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/admin/login` | POST | 管理后台登录 |
| `/api/admin/verify` | GET | 验证 JWT token |
| `/api/admin/status` | GET | 返回数据状态 |
| `/api/admin/upload` | POST | 上传 Excel 文件 |
| `/api/admin/import` | POST | 确认导入数据 |
| `/api/admin/clear` | POST | 清空数据 |

## 管理后台

访问 [http://localhost:3000/admin](http://localhost:3000/admin) 进入管理后台。

默认密码：`admin123456`（可通过 `.env` 文件中的 `ADMIN_PASSWORD` 修改）

## 数据库模型

### FundProduct

```prisma
model FundProduct {
  id                         Int      @id @default(autoincrement())
  dataDate                   DateTime
  strategyType               String
  fundManager                String
  managerScale               String
  isLargeScale               Boolean
  productName                String
  strategyCategory           String?
  weeklyReturn               Float?
  monthlyReturn              Float?
  ytdReturn                  Float?
  annualizedReturnSinceInception Float?
  ytdMaxDrawdown             Float?
  inceptionMaxDrawdown       Float?
  annualizedVolatility       Float?
  sharpeRatio                Float?
  createdAt                  DateTime @default(now())

  @@index([dataDate])
  @@index([dataDate, strategyType])
}
```

## 脚本命令

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint |
| `npm run db:push` | 推送数据库 Schema |
| `npm run db:generate` | 生成 Prisma 客户端 |
| `npm run db:studio` | 打开 Prisma Studio |

## 响应式设计

- **PC 端**：侧边栏固定，内容区最大宽度 1280px 居中
- **移动端**：
  - 汉堡图标 + 抽屉式导航
  - 统计卡片单列堆叠
  - 表格横向滚动
  - 日期选择器全宽显示

## 业务规则

1. 所有百分比数值以小数形式存储，展示时添加"%"符号
2. 计算分位数、均值时自动忽略 `null` 值
3. 无数据时显示"暂无数据"
4. 策略标识采用英文 slug，与菜单、路由严格对应
5. 管理后台密码通过环境变量 `ADMIN_PASSWORD` 设置
6. 系统初始加载时自动获取最新数据日期
7. 文件名解析逻辑：使用正则 `/_(\d{8})\.xlsx$/` 提取日期

## 部署

### Vercel 部署

1. 将代码推送到 GitHub 仓库
2. 在 Vercel 中导入项目
3. 设置环境变量：
   - `DATABASE_URL`（使用 PostgreSQL）
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
4. 点击部署

### 数据库迁移

生产环境使用 PostgreSQL：
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"
npm run db:push
npm run db:generate
```

## 常见问题

### 1. 如何查看数据库？
```bash
npm run db:studio
```
打开 Prisma Studio 查看和管理数据库。

### 2. 文件名解析失败？
确保文件名符合规范：`私募星工厂全量私募业绩跟踪_yyyymmdd.xlsx`

### 3. 如何修改管理后台密码？
修改 `.env` 文件中的 `ADMIN_PASSWORD` 值，然后重启服务器。

## 许可证

MIT

## 联系方式

如有问题，请联系项目维护者。