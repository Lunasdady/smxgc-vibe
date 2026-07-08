# 字段变更升级说明 - 2026-07-08

**升级日期**: 2026-07-08  
**影响范围**: 指增策略（500/1000/2000/另类指增）和套利策略  
**分支**: feature/add-chart

---

## 📋 变更概述

自 **2026-07-08** 起，上传的 Excel 文件中的字段定义将发生变化。系统会根据**数据日期**自动适配新旧字段，确保历史数据不受影响。

---

## 🔄 字段映射关系

### 1. 指数增强策略（500指增、1000指增、2000指增、另类指增）

| 旧字段（日期 < 2026-07-08） | 新字段（日期 >= 2026-07-08） |
|--------------------------|--------------------------|
| 近一周收益 | 近一周超额收益 |
| 近一月收益 | 近三月超额收益 |
| 今年以来收益 | 今年以来超额收益 |
| 成立以来年化收益 | 成立以来超额年化收益 |
| 今年以来最大回撤 | 今年以来超额最大回撤 |
| 成立以来最大回撤 | 成立以来超额最大回撤 |
| 成立以来年化波动率 | 成立以来超额年化波动率 |
| 成立以来夏普比率 | 成立以来超额夏普比率 |

### 2. 套利策略

| 旧字段（日期 < 2026-07-08） | 新字段（日期 >= 2026-07-08） |
|--------------------------|--------------------------|
| 成立以来夏普比率 | 成立以来卡玛比率 |

**注意**: 套利策略仅"夏普比率 → 卡玛比率"发生变化，其余指标保持不变。

---

## 🗄️ 数据库变更

### 新增字段（Prisma Schema）

```prisma
// === 新字段（日期 >= 2026-07-08，仅指增策略和套利策略）===
excessReturn1w             Float?   // 近一周超额收益（%）
excessReturn3m             Float?   // 近三月超额收益（%）
excessReturnYtd            Float?   // 今年以来超额收益（%）
excessAnnualizedReturn     Float?   // 成立以来超额年化收益（%）
excessYtdMaxDrawdown       Float?   // 今年以来超额最大回撤（%）
excessInceptionMaxDrawdown Float?   // 成立以来超额最大回撤（%）
excessAnnualizedVolatility Float?   // 成立以来超额年化波动率（%）
excessSharpeRatio          Float?   // 成立以来超额夏普比率
karmaRatio                 Float?   // 成立以来卡玛比率（套利策略）
```

### 执行迁移

```bash
node node_modules/prisma/build/index.js db push
```

---

## 🔧 后端变更

### 1. 数据导入逻辑（`src/app/api/admin/import/route.ts`）

**核心逻辑**:
```typescript
// 根据数据日期和策略类型判断使用新旧字段
const date = new Date(dataDate);
const cutoffDate = new Date('2026-07-08');
const isNewFields = date >= cutoffDate;

const indexEnhancedTypes = ['index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
const isIndexEnhanced = indexEnhancedTypes.includes(strategyType);
const isArbitrage = strategyType === 'arbitrage';

if (isNewFields && (isIndexEnhanced || isArbitrage)) {
  // 使用新字段（excessReturn1w, excessReturn3m, ...）
} else {
  // 使用旧字段（weeklyReturn, monthlyReturn, ...）
}
```

**Excel 列名映射**:
- 新字段期望的 Excel 列名：`近一周超额收益`、`近三月超额收益`、`今年以来超额收益` 等
- 旧字段期望的 Excel 列名：`近一周收益`、`近一月收益`、`今年以来收益` 等

---

## 🎨 前端变更

### 1. 类型定义（`src/lib/types.ts`）

**新增指标字段定义**:

```typescript
// 旧版指标（日期 < 2026-07-08）
export const METRIC_FIELDS_OLD = [
  { key: 'weeklyReturn', label: '近一周收益', isPercentage: true },
  { key: 'monthlyReturn', label: '近一月收益', isPercentage: true },
  // ...
];

// 新版指标 - 指增策略（日期 >= 2026-07-08）
export const METRIC_FIELDS_INDEX_ENHANCED_NEW = [
  { key: 'excessReturn1w', label: '近一周超额收益', isPercentage: true },
  { key: 'excessReturn3m', label: '近三月超额收益', isPercentage: true },
  // ...
];

// 新版指标 - 套利策略（日期 >= 2026-07-08）
export const METRIC_FIELDS_ARBITRAGE_NEW = [
  // ...
  { key: 'karmaRatio', label: '卡玛比率', isPercentage: false },
];

// 动态获取指标字段
export function getMetricFields(dataDate: string | null, strategyType: string | null) {
  if (!dataDate) return METRIC_FIELDS_OLD;
  
  const date = new Date(dataDate);
  const cutoffDate = new Date('2026-07-08');
  
  const indexEnhancedTypes = ['index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
  const isIndexEnhanced = indexEnhancedTypes.includes(strategyType || '');
  const isArbitrage = strategyType === 'arbitrage';
  
  if (date >= cutoffDate) {
    if (isIndexEnhanced) return METRIC_FIELDS_INDEX_ENHANCED_NEW;
    if (isArbitrage) return METRIC_FIELDS_ARBITRAGE_NEW;
  }
  
  return METRIC_FIELDS_OLD;
}
```

### 2. 首页概览页（`src/app/page.tsx`）

**变更**: 使用 `getMetricFields(dataDate, null)` 动态获取指标字段。

```typescript
const metricFields = getMetricFields(dataDate, null);
const currentMetric = metricFields.find(m => m.key === metric) || metricFields[0];
```

**注意**: 首页不指定策略类型，默认使用旧字段。

### 3. 策略详情页（`src/app/strategy/[type]/page.tsx`）

**变更**: 
1. 使用 `getMetricFields(dataDate, strategyType)` 动态获取指标字段
2. `DATA_COLUMNS` 改为动态生成

```typescript
const metricFields = getMetricFields(dataDate, strategyType);
const currentMetric = metricFields.find(m => m.key === metric) || metricFields[0];

// 动态数据列
const DATA_COLUMNS = metricFields.map(field => ({
  key: field.key as keyof FundProduct,
  label: field.label,
}));
```

**影响范围**:
- ✅ 箱型图指标筛选器 - 自动切换新旧指标名称
- ✅ 产品明细表列名 - 自动切换新旧列名
- ✅ 全屏表格 - 自动切换新旧列名
- ✅ 移动端列表 - 自动切换新旧列名

---

## 📊 测试指南

### 测试场景 1: 旧数据（日期 < 2026-07-08）

1. 选择日期 `2026-07-07` 或更早
2. 进入任意指增策略详情页（如 500指增）
3. **预期结果**:
   - 指标筛选器显示：近一周收益、近一月收益、今年以来收益...
   - 产品明细表列名：近一周收益、近一月收益...
   - 数据正常显示

### 测试场景 2: 新数据（日期 >= 2026-07-08）

1. 选择日期 `2026-07-08` 或更晚
2. 进入 500指增 详情页
3. **预期结果**:
   - 指标筛选器显示：近一周超额收益、近三月超额收益、今年以来超额收益...
   - 产品明细表列名：近一周超额收益、近三月超额收益...
   - 数据正常显示

### 测试场景 3: 套利策略新数据

1. 选择日期 `2026-07-08` 或更晚
2. 进入 套利策略 详情页
3. **预期结果**:
   - 指标筛选器最后显示"卡玛比率"（而非"夏普比率"）
   - 产品明细表最后一列为"卡玛比率"

### 测试场景 4: 不受影响的策略

1. 选择任意日期
2. 进入 300指增、主观多头、量化选股 等策略详情页
3. **预期结果**:
   - 指标名称始终保持旧字段名称
   - 不受日期影响

---

## ⚠️ 注意事项

### 1. Excel 文件命名规范

文件名必须包含日期，格式如：
```
私募星工厂全量私募业绩跟踪_20260708.xlsx
```

系统会解析 `20260708` 作为数据日期。

### 2. Excel 列名要求

**日期 >= 2026-07-08 的指增策略文件**，必须包含以下列：
- 近一周超额收益
- 近三月超额收益
- 今年以来超额收益
- 成立以来超额年化收益
- 今年以来超额最大回撤
- 成立以来超额最大回撤
- 成立以来超额年化波动率
- 成立以来超额夏普比率

**日期 >= 2026-07-08 的套利策略文件**，必须包含以下列：
- 近一周超额收益
- 近三月超额收益
- 今年以来超额收益
- 成立以来超额年化收益
- 今年以来超额最大回撤
- 成立以来超额最大回撤
- 成立以来超额年化波动率
- 成立以来卡玛比率

### 3. 历史数据兼容性

- ✅ 旧数据（日期 < 2026-07-08）继续使用旧字段
- ✅ 新数据（日期 >= 2026-07-08）使用新字段
- ✅ 两套字段在数据库中共存，互不影响
- ✅ 前端根据日期自动切换显示

### 4. 数据导入流程

1. 上传 Excel 文件（文件名包含日期）
2. 系统自动解析日期并判断使用新旧字段
3. 导入对应字段到数据库
4. 前端根据选择的日期动态显示对应指标

---

## 🚀 部署步骤

### 1. 数据库迁移

```bash
node node_modules/prisma/build/index.js db push
```

### 2. 重启开发服务器

```bash
node node_modules/next/dist/bin/next dev
```

### 3. 验证功能

按照上述"测试指南"逐项验证。

---

## 📝 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `prisma/schema.prisma` | 添加 9 个新字段 |
| `src/lib/types.ts` | 添加 3 套指标定义 + getMetricFields 函数 |
| `src/app/api/admin/import/route.ts` | 导入逻辑支持新旧字段映射 |
| `src/app/page.tsx` | 使用动态指标字段 |
| `src/app/strategy/[type]/page.tsx` | 动态生成 DATA_COLUMNS |

---

## 🎯 核心特性

✅ **自动切换**: 根据日期自动选择新旧字段  
✅ **历史兼容**: 旧数据不受影响  
✅ **策略区分**: 仅指增策略和套利策略使用新字段  
✅ **前端联动**: 筛选器、表格列名自动同步  
✅ **移动端适配**: 移动端列表同样支持动态列名  

---

**文档版本**: v1.0  
**最后更新**: 2026-07-08  
**维护者**: AI Assistant
