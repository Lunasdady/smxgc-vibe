# 私募星工场 - 升级文档

**版本**: v2.0  
**更新日期**: 2026-06-24  
**文档类型**: 功能优化与 Bug 修复

---

## 📋 升级概览

本次升级主要围绕 **用户体验优化**、**移动端交互改进**、**管理功能增强** 和 **UI/UX 视觉提升** 四个维度进行全面优化，共计完成 **17 项优化** 和 **3 个 Bug 修复**。

---

## 🎯 核心功能优化

### 1. 箱型图交互优化

#### 1.1 概览页箱型图查看明细按钮修复
**问题**: 点击"查看明细"按钮无法跳转至策略详情页  
**修复方案**:
- 为"查看明细"文字添加 `onClick` 事件处理
- 使用 `router.push()` 实现路由跳转
- 添加 `e.stopPropagation()` 避免触发卡片点击事件

**修改文件**: `src/app/page.tsx`

```tsx
<div 
  className="mt-3 flex items-center justify-between text-[12px] text-[#86868B] group-hover:text-[#0071E3] transition-colors cursor-pointer"
  onClick={(e) => {
    e.stopPropagation();
    router.push(`/strategy/${strategy.strategyType}`);
  }}
>
  <span>查看明细</span>
  <ChevronRight className="w-3.5 h-3.5 transform transition-transform group-hover:translate-x-0.5" />
</div>
```

#### 1.2 移动端箱型图浮窗触摸交互
**问题**: 移动端箱型图浮窗显示逻辑不符合移动端使用习惯  
**优化方案**:
- 改为触摸长按模式：手指按住显示浮窗，手指滑动更新位置，手指松开关闭浮窗
- 添加触摸设备检测
- 实现 `handleTouchStart`、`handleTouchEnd`、`handleTouchMove` 三个触摸事件处理器

**修改文件**:
- `src/components/BoxPlot.tsx` - 概览页箱型图
- `src/app/strategy/[type]/page.tsx` - 策略详情页箱型图

**交互逻辑**:
```typescript
// 触摸设备检测
const [isTouchDevice, setIsTouchDevice] = useState(false);

useEffect(() => {
  setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
}, []);

// 触摸开始 - 显示浮窗
const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
  if (!isTouchDevice) return;
  e.stopPropagation();
  const touch = e.touches[0];
  setTooltip({
    clientX: touch.clientX,
    clientY: touch.clientY,
    visible: true,
  });
};

// 触摸结束 - 关闭浮窗
const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
  if (!isTouchDevice) return;
  e.stopPropagation();
  setTooltip({ clientX: 0, clientY: 0, visible: false });
};

// 触摸移动 - 更新浮窗位置
const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
  if (!isTouchDevice) return;
  const touch = e.touches[0];
  setTooltip({
    clientX: touch.clientX,
    clientY: touch.clientY,
    visible: true,
  });
};
```

---

### 2. UI/UX 视觉优化

#### 2.1 策略下拉框网格布局
**优化前**: 垂直长条布局，策略分类按组排列  
**优化后**: 
- 3 列网格布局（桌面端）
- 2 列网格布局（移动端）
- 所有策略扁平化展示，无分组

**修改文件**: `src/components/Navbar.tsx`

```tsx
// 扁平化策略数组
const allStrategies = STRATEGY_GROUPS.flatMap((group) =>
  group.strategies.map((type) => ({
    type,
    name: STRATEGY_NAME_MAP[type],
    groupName: group.name,
  }))
);

// 网格布局
<div className="grid grid-cols-3 gap-1">
  {allStrategies.map((strategy) => (
    <Link
      key={strategy.type}
      href={`/strategy/${strategy.type}`}
      className="px-3 py-2.5 rounded-xl text-[13px] text-center"
    >
      {strategy.name}
    </Link>
  ))}
</div>
```

#### 2.2 Logo 重新设计
**设计理念**: 星形 + 工厂元素，极简线条风格

**设计令牌 (Design Tokens)**:
- **主色**: `#0071E3` (Apple Blue)
- **强调色**: `#E31B23` (红色增长曲线)
- **文字色**: `#1D1D1F` (Deep Space Gray)
- **字体**: `-apple-system, BlinkMacSystemFont, "PingFang SC"`
- **间距**: `gap: 14px`
- **悬停效果**: `translateY(-1px)` + 红色线条动画

**特性**:
- 纯 SVG 实现，无需外部图片
- 红色装饰线悬停动画（从左向右滑动 + 呼吸灯效果）
- 毛玻璃外框效果
- 响应式设计（移动端隐藏文字，仅显示图标）

**修改文件**: 
- `src/components/Navbar.tsx` - Logo 组件
- `src/app/globals.css` - 动画样式

```css
/* Logo 红色装饰线动画 */
.logo-accent-line {
  transition: stroke-dashoffset 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
  stroke-dasharray: 10;
  stroke-dashoffset: 0;
}

.logo-container:hover .logo-accent-line {
  stroke-dashoffset: -10;
  animation: logoAccentBreath 2s ease-in-out infinite;
}

@keyframes logoAccentBreath {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

#### 2.3 首页统计数据修复
**问题**: "跟踪策略"、"产品总数"、"中位收益"显示为 0  
**根因**: `useCountUp` hook 依赖 IntersectionObserver，但 ref 未绑定到 DOM 元素  
**修复方案**: 
- 为 `useCountUp` 添加 `trigger` 参数
- 使用 `statsReveal.revealed` 作为触发条件

**修改文件**:
- `src/hooks/useCountUp.ts`
- `src/app/page.tsx`

```typescript
// useCountUp hook 新增 trigger 参数
export function useCountUp(
  target: number,
  duration = 1500,
  decimals = 2,
  startOnView = true,
  trigger?: boolean  // 新增：外部触发条件
) {
  // ... 原有逻辑 ...
  
  // 外部 trigger 触发时启动动画
  useEffect(() => {
    if (trigger && !started) {
      setStarted(true);
    }
  }, [trigger, started]);
  
  // ... 动画逻辑 ...
}

// 首页使用
const { current: totalDisplay } = useCountUp(totalProducts, 1800, 0, true, statsReveal.revealed);
```

#### 2.4 箱型图 Tooltip 显示优化
**优化内容**:
- Tooltip 第一行显示指标名称（如"近一周收益"）而非策略类型
- 去除第二行的指标名称重复显示
- 统一首页和策略详情页的 Tooltip 样式

**修改文件**:
- `src/components/BoxPlot.tsx`
- `src/app/strategy/[type]/page.tsx`

```tsx
// Tooltip 标题改为显示指标名称
<div className="text-[13px] font-semibold text-[#1D1D1F] mb-1 pb-2 border-b border-[#0000000D]">
  {metricName || strategyName}
</div>
```

#### 2.5 去除冗余图例
**优化内容**:
- 去除首页和策略详情页箱型图下方的"中位数"、"均值"图例
- 保留"查看明细"按钮（首页）和数量统计（策略详情页）

**修改文件**:
- `src/components/BoxPlot.tsx`
- `src/app/strategy/[type]/page.tsx`

---

### 3. 策略详情页优化

#### 3.1 滚动揭示动画
**问题**: 策略详情页进入时无动画效果  
**优化方案**: 
- 添加 `useScrollReveal` hooks（headerReveal, boxPlotReveal, tableReveal）
- 为标题区域、箱型图区域、产品明细区域添加 scroll-reveal 类
- 数据加载完成后强制触发 reveal

**修改文件**: `src/app/strategy/[type]/page.tsx`

```typescript
// Scroll reveal hooks
const headerReveal = useScrollReveal();
const boxPlotReveal = useScrollReveal();
const tableReveal = useScrollReveal();

// 数据加载完成后强制触发
useEffect(() => {
  if (!loading && groupSummary) {
    requestAnimationFrame(() => {
      boxPlotReveal.forceReveal();
      tableReveal.forceReveal();
    });
  }
}, [loading, groupSummary]);
```

#### 3.2 筛选器位置调整
**优化前**: 指标筛选和日期筛选在产品明细表上方  
**优化后**: 移到箱型图上方，与"规模分布对比"标题同行

**修改文件**: `src/app/strategy/[type]/page.tsx`

#### 3.3 产品明细表冻结列
**优化内容**: 
- "产品名称"列在横向滚动时固定
- 使用 `position: sticky` 实现
- 表头和表体分别设置背景色

**修改文件**: `src/app/strategy/[type]/page.tsx`

```tsx
// 表头
<th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap sticky left-0 z-10 bg-[#FAFAFB]">
  产品名称
</th>

// 表体
<td className="px-5 py-3 text-[14px] text-[#1D1D1F] font-medium whitespace-nowrap sticky left-0 z-10 bg-white">
  {product.productName}
</td>
```

#### 3.4 产品明细表全屏模式
**新增功能**: 
- 点击全屏按钮进入全屏查看模式
- 一屏展示所有指标列（12 列）
- 固定顶部导航栏，包含标题、搜索框和退出按钮
- "产品名称"列保持冻结
- 使用 `createPortal` 渲染到最高层级

**修改文件**: `src/app/strategy/[type]/page.tsx`

**全屏模式特性**:
- 最大宽度 `1800px`
- 最小宽度 `1400px`（确保所有列一屏显示）
- 减少内边距为表格留出更多空间
- 背景色 `bg-[#F5F5F7]`，可滚动查看所有产品

```tsx
// 全屏按钮
<button
  onClick={() => setIsTableFullscreen(true)}
  className="p-2 rounded-xl bg-[#FFFFFF] border border-[#0000000D] hover:bg-[#00000006] transition-all duration-200 group"
  title="全屏查看"
>
  <Maximize2 className="w-4 h-4 text-[#86868B] group-hover:text-[#1D1D1F] transition-colors" />
</button>

// 全屏模态框
{isTableFullscreen && createPortal(
  <div className="fixed inset-0 z-[100] bg-[#F5F5F7] overflow-auto">
    {/* 固定顶部导航栏 */}
    <div className="sticky top-0 z-10 glass-card border-b border-[#0000000D] backdrop-blur-xl bg-[#F5F5F7]/90">
      {/* ... */}
    </div>
    
    {/* 全屏表格 */}
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
      <div className="overflow-x-auto" style={{ minWidth: '1400px' }}>
        {/* ... 表格内容 ... */}
      </div>
    </div>
  </div>,
  document.body
)}
```

---

### 4. 管理后台增强

#### 4.1 管理端 UI 主题迁移
**问题**: 管理端使用深色主题 CSS 类，但项目已改为浅色 Apple 风格，导致页面无法显示  
**修复方案**: 
- 将所有深色主题类替换为浅色 Apple 风格
- 统一使用 `glass-card`、`bg-[#F5F5F7]`、`text-[#1D1D1F]` 等设计令牌

**修改文件**: `src/app/admin/page.tsx`

**样式映射表**:
| 原深色主题 | 新浅色 Apple 风格 |
|-----------|------------------|
| `bg-dark-bg` | `bg-[#F5F5F7]` |
| `bg-dark-card` | `bg-[#FFFFFF]` 或 `glass-card` |
| `border-dark-border` | `border-[#0000000D]` |
| `text-dark-text` | `text-[#1D1D1F]` |
| `text-dark-textDim` | `text-[#86868B]` |
| `text-cyan-400` | `text-[#0071E3]` |
| `text-green-400` | `text-[#16A34A]` |
| `text-red-400` | `text-[#DC2626]` |
| `rounded-lg` | `rounded-xl` |
| `rounded-lg` (卡片) | `rounded-2xl` |

#### 4.2 首页文案编辑功能
**新增功能**: 管理端可自定义首页顶部文案

**功能特性**:
- 支持主标题和副标题编辑
- 主标题支持 HTML 标签（如高亮文字）
- 使用 localStorage 持久化存储
- 实时预览当前文案
- 一键恢复默认文案

**修改文件**:
- `src/lib/store.ts` - 添加文案状态管理
- `src/app/page.tsx` - 从 store 读取文案
- `src/app/admin/page.tsx` - 添加文案编辑 UI

**使用方法**:
1. 登录管理后台
2. 找到"首页文案设置"卡片
3. 点击"编辑文案"按钮
4. 修改主标题和副标题
5. 点击"保存文案"
6. 刷新首页查看效果

**主标题 HTML 示例**:
```html
穿越周期的<span className="text-[#0071E3]">价值投资</span>
聚焦<span className="text-[#0071E3]">核心策略</span>，创造<span className="text-[#DC2626]">卓越回报</span>
```

**代码实现**:
```typescript
// store.ts - 状态管理
export const useAppStore = create<AppState>((set, get) => ({
  heroTitle: typeof window !== 'undefined' 
    ? (localStorage.getItem('heroTitle') || '穿越周期的<span className="text-[#0071E3]">价值投资</span>') 
    : '穿越周期的<span className="text-[#0071E3]">价值投资</span>',
  heroSubtitle: typeof window !== 'undefined' 
    ? (localStorage.getItem('heroSubtitle') || '私募星工场全量业绩跟踪平台，实时监控多维度策略表现') 
    : '私募星工场全量业绩跟踪平台，实时监控多维度策略表现',
  setHeroTitle: (title) => set({ heroTitle: title }),
  setHeroSubtitle: (subtitle) => set({ heroSubtitle: subtitle }),
}));

// page.tsx - 渲染文案
<h1 className="large-title text-[#1D1D1F] mb-4" dangerouslySetInnerHTML={{ __html: heroTitle }} />
<p className="text-[19px] text-[#86868B] max-w-2xl mx-auto leading-relaxed">
  {heroSubtitle}
</p>
```

#### 4.3 管理端认证逻辑优化
**优化内容**: 
- 将 `verifyToken` 函数内联到 `useEffect` 中
- 简化认证流程，避免竞态条件
- 改进错误处理

**修改文件**: `src/app/admin/page.tsx`

---

### 5. 其他优化

#### 5.1 去除"投资者登录"按钮
**优化内容**: 从导航栏移除"投资者登录"按钮，仅保留"管理"链接

**修改文件**: `src/components/Navbar.tsx`

#### 5.2 去除冗余的"查看明细"按钮
**优化内容**: 
- 去除首页箱型图容器下方的"查看明细"按钮
- 该按钮与鼠标悬停时显示的"查看明细"重复

**修改文件**: `src/components/BoxPlot.tsx`

#### 5.3 箱型图渲染优化
**优化内容**:
- 修复箱型图因 SVG 高度未设置导致的渲染问题
- 确保在 `useScrollReveal` 动画后保持可见
- 数据加载完成后使用 `requestAnimationFrame` 强制触发显示

---

## 🐛 Bug 修复清单

| Bug 描述 | 影响范围 | 修复方案 | 修改文件 |
|---------|---------|---------|---------|
| 概览页箱型图"查看明细"无法跳转 | 首页 | 添加 onClick 事件和路由跳转 | `src/app/page.tsx` |
| 首页统计数据始终显示为 0 | 首页 Hero 区域 | 添加 trigger 参数触发数字动画 | `src/hooks/useCountUp.ts`, `src/app/page.tsx` |
| 管理端页面无法显示 | 管理后台 | 深色主题类替换为浅色 Apple 风格 | `src/app/admin/page.tsx` |
| 策略详情页箱型图和产品明细表不显示 | 策略详情页 | 数据加载后强制触发 scroll-reveal | `src/app/strategy/[type]/page.tsx` |

---

## 📁 修改文件清单

### 核心组件
- `src/components/Navbar.tsx` - 导航栏、Logo、策略下拉框
- `src/components/BoxPlot.tsx` - 箱型图组件、Tooltip、触摸交互

### 页面
- `src/app/page.tsx` - 首页、统计数据、文案展示
- `src/app/strategy/[type]/page.tsx` - 策略详情页、全屏表格、触摸交互
- `src/app/admin/page.tsx` - 管理后台、文案编辑、主题迁移

### Hooks
- `src/hooks/useCountUp.ts` - 数字滚动动画、trigger 参数
- `src/hooks/useScrollReveal.ts` - 滚动揭示动画（未修改，但广泛使用）

### 状态管理
- `src/lib/store.ts` - 全局状态、文案状态

### 样式
- `src/app/globals.css` - Logo 动画、全局样式

---

## 🎨 设计令牌 (Design Tokens)

### 颜色系统
```css
/* 主色 */
--accent: #0071E3;        /* Apple Blue */
--accent-hover: #0077ED;

/* 文字色 */
--text-primary: #1D1D1F;  /* Deep Space Gray */
--text-secondary: #86868B;
--text-tertiary: #A1A1A6;

/* 背景色 */
--bg-primary: #F5F5F7;    /* Apple Light Gray */
--bg-card: rgba(255, 255, 255, 0.72);
--bg-card-solid: #FFFFFF;

/* 强调色 */
--positive: #DC2626;      /* Red - 收益上涨 */
--negative: #16A34A;      /* Green - 收益下跌 */

/* 边框 */
--border-color: rgba(0, 0, 0, 0.08);

/* Logo 强调色 */
--logo-accent: #E31B23;   /* Red - 增长曲线 */
```

### 圆角规范
- 小圆角: `rounded-lg` (8px)
- 中圆角: `rounded-xl` (12px)
- 大圆角: `rounded-2xl` (16px)
- 超大圆角: `rounded-3xl` (24px)

### 字体规范
- 字体系列: `-apple-system, BlinkMacSystemFont, "SF Pro SC", "SF Pro Text", "Helvetica Neue", "PingFang SC"`
- 标题: `clamp(40px, 5vw, 64px)`, font-weight: 700
- 副标题: `clamp(28px, 3.5vw, 40px)`, font-weight: 600
- 正文: 13px - 19px

### 间距规范
- Logo 图标与文字: `gap: 14px`
- 卡片内边距: `p-5` (20px) / `p-6` (24px)
- 网格间距: `gap-4` (16px)

---

## 🔧 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **图表**: SVG 自定义渲染
- **动画**: CSS Transitions + IntersectionObserver
- **UI 组件**: Lucide Icons

---

## 📊 性能优化

1. **触摸设备检测优化**: 仅在组件挂载时检测一次，避免重复计算
2. **防抖处理**: Tooltip 位置计算使用 requestAnimationFrame
3. **Portal 渲染**: Tooltip 和全屏模态框使用 createPortal 避免重渲染
4. **条件渲染**: 根据 `isTouchDevice` 跳过不必要的事件监听

---

## 🚀 部署说明

### 环境变量
```env
# 管理后台密码
ADMIN_PASSWORD="admin123456"

# JWT 密钥（生产环境请修改）
JWT_SECRET="your-secret-key-change-in-production"

# 数据库连接
DATABASE_URL="file:./dev.db"
```

### 启动命令
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### 访问地址
- **首页**: http://localhost:3000/
- **管理后台**: http://localhost:3000/admin
- **策略详情页**: http://localhost:3000/strategy/[type]

---

## 📝 使用说明

### 管理后台文案编辑

1. 访问管理后台: `http://localhost:3000/admin`
2. 输入密码: `admin123456`
3. 找到"首页文案设置"卡片
4. 点击"编辑文案"按钮
5. 修改主标题（支持 HTML）和副标题
6. 点击"保存文案"
7. 刷新首页查看效果

### 主标题 HTML 示例

```html
<!-- 基础高亮 -->
穿越周期的<span className="text-[#0071E3]">价值投资</span>

<!-- 多色高亮 -->
聚焦<span className="text-[#0071E3]">核心策略</span>，创造<span className="text-[#DC2626]">卓越回报</span>

<!-- 加粗高亮 -->
<span className="font-bold text-[#0071E3]">私募星工场</span> - 专业业绩跟踪平台
```

---

## ⚠️ 注意事项

1. **生产环境安全**: 
   - 务必修改 `ADMIN_PASSWORD` 为强密码
   - 务必修改 `JWT_SECRET` 为随机字符串
   - 不要将 `.env` 文件提交到版本控制

2. **文案编辑**:
   - 主标题支持 HTML 标签，但请勿注入恶意代码
   - 使用 `className` 而非 `class` 属性
   - 标签必须正确闭合

3. **移动端交互**:
   - 箱型图浮窗在移动端使用触摸交互
   - 手指按住显示，手指松开关闭
   - 滑动时浮窗位置会跟随手指移动

4. **全屏表格**:
   - 全屏模式下最小宽度为 1400px
   - 建议在大屏幕设备上使用
   - 产品名称列始终冻结

---

## 🔄 向后兼容性

- ✅ 所有现有 API 保持不变
- ✅ 数据库结构未修改
- ✅ 路由结构保持不变
- ✅ 现有功能完全兼容

---

## 📞 技术支持

如有问题，请查看：
- 项目 README: `README.md`
- 环境变量配置: `.env`
- 数据库 Schema: `prisma/schema.prisma`

---

**文档版本**: v1.0  
**最后更新**: 2026-06-24  
**维护者**: 私募星工场开发团队
