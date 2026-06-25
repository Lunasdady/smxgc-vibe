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
  'arbitrage': '套利策略',
  'macro-strategy': '宏观策略',
  'composite-strategy': '复合策略',
  'strong-stock': '强势股',
};

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
    strategies: ['subjective-futures', 'quantitative-futures'],
    hasSubmenu: true,
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

// 五数统计类型
export interface FiveNumberStats {
  count: number;
  min: number | null;
  q25: number | null;
  mean: number | null;
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
  mean: number | null;
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
  weeklyReturn: number | null;
  monthlyReturn: number | null;
  ytdReturn: number | null;
  annualizedReturnSinceInception: number | null;
  ytdMaxDrawdown: number | null;
  inceptionMaxDrawdown: number | null;
  annualizedVolatility: number | null;
  sharpeRatio: number | null;
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
