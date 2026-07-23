// 策略类型映射
export const STRATEGY_MAP: Record<string, string> = {
  '主观多头': 'subjective-long',
  '300指增': 'index-enhanced-300',
  '500指增': 'index-enhanced-500',
  '1000指增': 'index-enhanced-1000',
  '2000指增': 'index-enhanced-2000',
  '另类指增': 'index-enhanced-alternative',
  '量化选股': 'quantitative-stock-selection',
  '择时&多空': 'timing-long-short',
  '市场中性&T0': 'market-neutral-t0',
  '可转债多头': 'convertible-bond-long',
  '主观期货': 'subjective-futures',
  '量化期货': 'quantitative-futures',
  '主观CTA': 'subjective-cta',
  '量化CTA': 'quantitative-cta',
  '复合CTA': 'composite-cta',
  '套利策略': 'arbitrage',
  '宏观策略': 'macro-strategy',
  '复核策略': 'composite-strategy',
  '复合策略': 'composite-strategy',
  '强势股': 'strong-stock',
};

export const STRATEGY_NAME_MAP: Record<string, string> = {
  'subjective-long': '主观多头',
  'index-enhanced-300': '300指增',
  'index-enhanced-500': '500指增',
  'index-enhanced-1000': '1000指增',
  'index-enhanced-2000': '2000指增',
  'index-enhanced-alternative': '另类指增',
  'quantitative-stock-selection': '量化选股',
  'timing-long-short': '择时&多空',
  'market-neutral-t0': '市场中性&T0',
  'convertible-bond-long': '可转债多头',
  'subjective-futures': '主观期货',
  'quantitative-futures': '量化期货',
  'subjective-cta': '主观CTA',
  'quantitative-cta': '量化CTA',
  'composite-cta': '复合CTA',
  'arbitrage': '套利策略',
  'macro-strategy': '宏观策略',
  'composite-strategy': '复合策略',
  'strong-stock': '强势股',
};

// 期货策略类型分组（2026-06-17前后使用不同分类）
export const FUTURES_CUTOFF_DATE = '2026-06-17';

// 旧期货策略（日期 < 2026-06-17）
export const OLD_FUTURES_STRATEGIES = ['subjective-futures', 'quantitative-futures'];

// 新CTA策略（日期 >= 2026-06-17）
export const NEW_CTA_STRATEGIES = ['subjective-cta', 'quantitative-cta', 'composite-cta'];

// 根据日期获取正确的期货策略列表
export function getFuturesStrategies(dataDate: string | null): string[] {
  if (!dataDate) return OLD_FUTURES_STRATEGIES;
  
  const date = new Date(dataDate);
  const cutoffDate = new Date(FUTURES_CUTOFF_DATE);
  
  return date >= cutoffDate ? NEW_CTA_STRATEGIES : OLD_FUTURES_STRATEGIES;
}

// 策略分组
export const STRATEGY_GROUPS = [
  {
    name: '指增策略',
    strategies: [
      'index-enhanced-300',
      'index-enhanced-500',
      'index-enhanced-1000',
      'index-enhanced-2000',
      'index-enhanced-alternative',
    ],
    hasSubmenu: true,
  },
  {
    name: '主观多头',
    strategies: ['subjective-long'],
    hasSubmenu: false,
  },
  {
    name: '量化选股',
    strategies: ['quantitative-stock-selection'],
    hasSubmenu: false,
  },
  {
    name: '择时&多空',
    strategies: ['timing-long-short'],
    hasSubmenu: false,
  },
  {
    name: '市场中性&T0',
    strategies: ['market-neutral-t0'],
    hasSubmenu: false,
  },
  {
    name: '可转债多头',
    strategies: ['convertible-bond-long'],
    hasSubmenu: false,
  },
  {
    name: '期货策略',
    strategies: OLD_FUTURES_STRATEGIES, // 会被 getFuturesStrategies 动态替换
    hasSubmenu: true,
    isDynamic: true, // 标记为动态策略组
  },
  {
    name: '套利策略',
    strategies: ['arbitrage'],
    hasSubmenu: false,
  },
  {
    name: '宏观策略',
    strategies: ['macro-strategy'],
    hasSubmenu: false,
  },
  {
    name: '复合策略',
    strategies: ['composite-strategy'],
    hasSubmenu: false,
  },
  {
    name: '强势股',
    strategies: ['strong-stock'],
    hasSubmenu: false,
  },
];

// 指标字段定义（旧版 - 日期 < 2026-07-08）
export const METRIC_FIELDS_OLD: { key: string; label: string; isPercentage: boolean }[] = [
  { key: 'weeklyReturn', label: '近一周收益', isPercentage: true },
  { key: 'monthlyReturn', label: '近一月收益', isPercentage: true },
  { key: 'ytdReturn', label: '今年以来收益', isPercentage: true },
  { key: 'annualizedReturnSinceInception', label: '成立以来年化', isPercentage: true },
  { key: 'ytdMaxDrawdown', label: '今年最大回撤', isPercentage: true },
  { key: 'inceptionMaxDrawdown', label: '成立最大回撤', isPercentage: true },
  { key: 'annualizedVolatility', label: '年化波动率', isPercentage: true },
  { key: 'sharpeRatio', label: '夏普比率', isPercentage: false },
];

// 指标字段定义（新版 - 日期 >= 2026-07-08，仅指增策略）
export const METRIC_FIELDS_INDEX_ENHANCED_NEW: { key: string; label: string; isPercentage: boolean }[] = [
  { key: 'excessReturn1w', label: '近一周超额收益', isPercentage: true },
  { key: 'excessReturn3m', label: '近三月超额收益', isPercentage: true },
  { key: 'excessReturnYtd', label: '今年以来超额收益', isPercentage: true },
  { key: 'excessAnnualizedReturn', label: '成立以来超额年化', isPercentage: true },
  { key: 'excessYtdMaxDrawdown', label: '今年超额最大回撤', isPercentage: true },
  { key: 'excessInceptionMaxDrawdown', label: '成立超额最大回撤', isPercentage: true },
  { key: 'excessAnnualizedVolatility', label: '超额年化波动率', isPercentage: true },
  { key: 'excessSharpeRatio', label: '超额夏普比率', isPercentage: false },
];

// 指标字段定义（新版 - 日期 >= 2026-07-08，仅套利策略）
export const METRIC_FIELDS_ARBITRAGE_NEW: { key: string; label: string; isPercentage: boolean }[] = [
  { key: 'weeklyReturn', label: '近一周收益', isPercentage: true },
  { key: 'monthlyReturn', label: '近一月收益', isPercentage: true },
  { key: 'ytdReturn', label: '今年以来收益', isPercentage: true },
  { key: 'annualizedReturnSinceInception', label: '成立以来年化', isPercentage: true },
  { key: 'ytdMaxDrawdown', label: '今年最大回撤', isPercentage: true },
  { key: 'inceptionMaxDrawdown', label: '成立最大回撤', isPercentage: true },
  { key: 'annualizedVolatility', label: '年化波动率', isPercentage: true },
  { key: 'karmaRatio', label: '卡玛比率', isPercentage: false },
];

// 根据日期和策略类型动态获取指标字段
export function getMetricFields(dataDate: string | null, strategyType: string | null): { key: string; label: string; isPercentage: boolean }[] {
  if (!dataDate) return METRIC_FIELDS_OLD;

  const date = new Date(dataDate);
  const cutoffDate = new Date('2026-07-08');

  // 检查是否是需要使用新字段的策略类型（包括300指增）
  const indexEnhancedTypes = ['index-enhanced-300', 'index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
  const isIndexEnhanced = indexEnhancedTypes.includes(strategyType || '');
  const isArbitrage = strategyType === 'arbitrage';

  if (date >= cutoffDate) {
    // 概览页（strategyType 为 null）默认显示指增新字段
    if (!strategyType || isIndexEnhanced) return METRIC_FIELDS_INDEX_ENHANCED_NEW;
    if (isArbitrage) return METRIC_FIELDS_ARBITRAGE_NEW;
  }

  return METRIC_FIELDS_OLD;
}

// 非指增策略的指标名称映射（将指增新指标映射为对应的绝对收益指标）
export function getNonIndexEnhancedMetricLabel(metricKey: string): string {
  const mapping: Record<string, string> = {
    'excessReturn1w': '近一周收益',
    'excessReturn3m': '近一月收益',
    'excessReturnYtd': '今年以来收益',
    'excessAnnualizedReturn': '成立以来年化收益',
    'excessYtdMaxDrawdown': '今年以来最大回撤',
    'excessInceptionMaxDrawdown': '成立以来最大回撤',
    'excessAnnualizedVolatility': '成立以来年化波动率',
    'excessSharpeRatio': '成立以来夏普比率',
  };
  return mapping[metricKey] || '近一周收益';
}

// 兼容旧代码的默认导出（使用旧字段）
export const METRIC_FIELDS = METRIC_FIELDS_OLD;

// 五数统计类型
export interface FiveNumberStats {
  count: number;
  min: number | null;
  q25: number | null;
  median: number | null;
  q75: number | null;
  max: number | null;
}

// 策略概览数据
export interface StrategyOverview {
  strategyType: string;
  strategyName: string;
  count: number;
  min: number | null;
  q25: number | null;
  median: number | null;
  q75: number | null;
  max: number | null;
}

// 产品数据
export interface FundProduct {
  id: number;
  dataDate: Date;
  strategyType: string;
  fundManager: string;
  managerScale: string;
  isLargeScale: boolean;
  productName: string;
  strategyCategory: string | null;
  // 旧字段（日期 < 2026-07-08）
  weeklyReturn: number | null;
  monthlyReturn: number | null;
  ytdReturn: number | null;
  annualizedReturnSinceInception: number | null;
  ytdMaxDrawdown: number | null;
  inceptionMaxDrawdown: number | null;
  annualizedVolatility: number | null;
  sharpeRatio: number | null;
  // 新字段（日期 >= 2026-07-08，仅指增策略和套利策略）
  excessReturn1w: number | null;
  excessReturn3m: number | null;
  excessReturnYtd: number | null;
  excessAnnualizedReturn: number | null;
  excessYtdMaxDrawdown: number | null;
  excessInceptionMaxDrawdown: number | null;
  excessAnnualizedVolatility: number | null;
  excessSharpeRatio: number | null;
  karmaRatio: number | null;
  createdAt: Date;
}

// 分组统计
export interface GroupSummary {
  largeScale: FiveNumberStats;
  smallScale: FiveNumberStats;
}

// 产品查询参数
export interface ProductQueryParams {
  dataDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
