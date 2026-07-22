import { create } from 'zustand';

interface AppState {
  // 当前选中的数据日期
  dataDate: string | null;
  // 所有可用的数据日期列表
  availableDates: string[];
  // 当前选中的指标字段
  metric: string;
  // 是否正在初始化
  initializing: boolean;
  // 首页顶部文案
  heroTitle: string;
  heroSubtitle: string;
  // 设置数据日期
  setDataDate: (date: string) => void;
  // 设置可用日期列表
  setAvailableDates: (dates: string[]) => void;
  // 设置指标字段
  setMetric: (metric: string) => void;
  // 设置首页文案
  setHeroTitle: (title: string) => void;
  setHeroSubtitle: (subtitle: string) => void;
  // 初始化时获取最新日期
  initialize: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  dataDate: null,
  availableDates: [],
  metric: 'weeklyReturn',
  initializing: true,
  heroTitle: typeof window !== 'undefined' ? (localStorage.getItem('heroTitle') || '穿越周期的<span className="text-[#0071E3]">价值投资</span>') : '穿越周期的<span className="text-[#0071E3]">价值投资</span>',
  heroSubtitle: typeof window !== 'undefined' ? (localStorage.getItem('heroSubtitle') || '私募星工厂全量业绩跟踪平台，实时监控多维度策略表现') : '私募星工厂全量业绩跟踪平台，实时监控多维度策略表现',
  setDataDate: (date) => set({ dataDate: date }),
  setAvailableDates: (dates) => set({ availableDates: dates }),
  setMetric: (metric) => set({ metric }),
  setHeroTitle: (title) => set({ heroTitle: title }),
  setHeroSubtitle: (subtitle) => set({ heroSubtitle: subtitle }),
  initialize: async () => {
    try {
      console.log('[Store] 开始初始化...');
      
      // 并行获取最新日期和首页文案
      const [dateResponse, heroResponse] = await Promise.all([
        fetch('/api/data/latest-date'),
        fetch('/api/admin/hero-text'),
      ]);

      const dateData = await dateResponse.json();
      const heroData = await heroResponse.json();

      console.log('[Store] API返回数据:', { dateData, heroData });

      if (dateData.date) {
        const cutoffDate = new Date('2026-07-08');
        const dataDateObj = new Date(dateData.date);
        const shouldUseNewMetric = dataDateObj >= cutoffDate;

        console.log('[Store] 设置日期和指标:', { 
          date: dateData.date, 
          metric: shouldUseNewMetric ? 'excessReturn1w' : 'weeklyReturn' 
        });

        set({
          dataDate: dateData.date,
          metric: shouldUseNewMetric ? 'excessReturn1w' : 'weeklyReturn',
          initializing: false
        });
      } else {
        console.warn('[Store] 未获取到日期数据,设置initializing=false');
        set({ initializing: false });
      }

      // 获取所有可用日期
      const datesResponse = await fetch('/api/data/dates');
      const datesData = await datesResponse.json();
      if (datesData.dates) {
        set({ availableDates: datesData.dates });
      }

      // 设置首页文案
      if (heroData.heroTitle) {
        set({ heroTitle: heroData.heroTitle });
      }
      if (heroData.heroSubtitle) {
        set({ heroSubtitle: heroData.heroSubtitle });
      }

      console.log('[Store] 初始化完成');
    } catch (error) {
      console.error('[Store] 初始化失败:', error);
      set({ initializing: false });
    }
  },
}));
