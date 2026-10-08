# 走势列集成指南

**日期**: 2026-09-19  
**状态**: 📝 待实施

---

## 📋 需求回顾

在策略详情页的产品明细列表最后一列增加"走势"列：
- 鼠标移到该部分，浮窗展示单位净值的折线趋势图
- 移动端暂时不增加此功能
- 桌面端显示，移动端隐藏

---

## 🔧 已完成组件

### 1. TrendTooltip组件 ✅
- **文件**: `src/components/TrendTooltip.tsx`
- **功能**: 
  - 鼠标悬停显示近6个月净值折线图
  - 自动调用 `/api/product/trend` API
  - Apple风格玻璃态设计
  - 响应式图表

### 2. 产品走势API ✅
- **路径**: `/api/product/trend`
- **参数**: productCode, months
- **返回**: 近6个月周五的净值数据

---

## ⚠️ 当前问题

### FundProduct接口缺少productCode字段

**现状**：
- FundProduct表没有productCode字段
- 趋势API需要productCode作为参数
- 无法直接从FundProduct获取productCode

**解决方案**：

#### 方案A: 通过strategyCategory关联（推荐）

**步骤**：
1. 在获取产品列表API中，通过strategyCategory关联StrategyMapping表
2. 查询匹配的产品代码
3. 将productCode添加到FundProduct返回数据中

**示例代码**：
```typescript
// 在 /api/strategies/[type]/products/route.ts 中
const products = await prisma.fundProduct.findMany({
  where: { strategyType, dataDate },
  include: {
    strategyMapping: {
      select: { productCode: true }
    }
  }
});

// 映射数据
const mappedProducts = products.map(p => ({
  ...p,
  productCode: p.strategyMapping?.productCode || null,
}));
```

#### 方案B: 使用productName匹配

**步骤**：
1. 在StrategyMapping表中查找productName相同的记录
2. 获取对应的productCode
3. 前端缓存映射关系

**缺点**：
- 产品名称可能不完全匹配
- 性能较差

#### 方案C: 添加productCode到FundProduct表

**步骤**：
1. 修改Prisma schema，添加productCode字段到FundProduct模型
2. 运行数据库迁移
3. 数据导入时同步写入productCode

**优点**：
- 最直接、最可靠
- 性能最佳

---

## 📝 集成步骤（假设采用方案A或C）

### 步骤1: 确保API返回productCode

修改策略产品列表API，确保返回productCode字段。

### 步骤2: 更新FundProduct类型定义

```typescript
export interface FundProduct {
  // ... 现有字段
  productCode?: string; // 新增
}
```

### 步骤3: 在表格中添加走势列

修改 `src/app/strategy/[type]/page.tsx`：

```tsx
import TrendTooltip from '@/components/TrendTooltip';
import { TrendingUp } from 'lucide-react';

// 在表格表头添加走势列（仅桌面端）
<thead>
  <tr>
    {/* ... 现有列 ... */}
    <th className="px-5 py-3 text-center text-[13px] font-medium text-[#86868B] whitespace-nowrap hidden md:table-cell">
      走势
    </th>
  </tr>
</thead>

// 在表格数据行添加走势列
<tbody>
  {paginatedProducts.map((product) => (
    <tr key={product.id}>
      {/* ... 现有列 ... */}
      <td className="px-5 py-3 text-center whitespace-nowrap hidden md:table-cell">
        {product.productCode ? (
          <TrendTooltip 
            productCode={product.productCode}
            productName={product.productName}
          >
            <button className="p-2 rounded-lg hover:bg-[#0071E3]/10 transition-colors group">
              <TrendingUp className="w-4 h-4 text-[#0071E3] group-hover:scale-110 transition-transform" />
            </button>
          </TrendTooltip>
        ) : (
          <span className="text-[#A1A1A6]">-</span>
        )}
      </td>
    </tr>
  ))}
</tbody>
```

### 步骤4: 全屏模式也添加走势列

在全屏表格（isTableFullscreen）中也添加相同的走势列。

### 步骤5: 移动端隐藏

使用Tailwind的响应式类：
- `hidden md:table-cell` - 移动端隐藏，桌面端显示

---

## 🎨 UI设计

### 走势图标
- 使用Lucide的 `TrendingUp` 图标
- 蓝色主题色 `#0071E3`
- 悬停时放大效果

### 浮窗样式
- Apple玻璃态设计
- 320px宽度
- 180px高度图表
- 圆角24px
- 阴影效果

---

## 📱 响应式设计

### 桌面端（≥768px）
- ✅ 显示走势列
- ✅ 鼠标悬停显示浮窗
- ✅ 完整交互体验

### 移动端（<768px）
- ❌ 隐藏走势列
- ❌ 不加载浮窗组件
- ✅ 节省性能

---

## 🔍 测试要点

### 功能测试
1. ✅ 鼠标悬停是否正确显示浮窗
2. ✅ 浮窗内折线图是否正确渲染
3. ✅ 数据是否来自正确的productCode
4. ✅ 移动端是否正确隐藏

### 性能测试
1. ✅ 浮窗是否懒加载（首次悬停时才请求数据）
2. ✅ 数据是否缓存（避免重复请求）
3. ✅ 多个产品快速悬停是否流畅

### 边界情况
1. ✅ productCode为空时显示"-"
2. ✅ API返回错误时显示错误信息
3. ✅ 无数据时显示"暂无走势数据"

---

## 🚀 下一步

1. **选择方案**: 确定使用哪种方式获取productCode
2. **修改API**: 确保产品列表API返回productCode
3. **集成组件**: 在策略详情页添加走势列
4. **测试验证**: 完整测试所有场景

---

**文档创建时间**: 2026-09-19  
**负责人**: AI Assistant  
**优先级**: 中等（核心功能已就绪，仅需集成）
