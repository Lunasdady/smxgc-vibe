import { create } from 'zustand';

interface AppState {
  // 当前选中的数据日期
  dataDate: string | null;
  // 所有可用的数据日期列表
  availableDates: string[];
  // 设置数据日期
  setDataDate: (date: string) => void;
  // 设置可用日期列表
  setAvailableDates: (dates: string[]) => void;
  // 初始化时获取最新日期
  initialize: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  dataDate: null,
  availableDates: [],
  setDataDate: (date) => set({ dataDate: date }),
  setAvailableDates: (dates) => set({ availableDates: dates }),
  initialize: async () => {
    try {
      const response = await fetch('/api/data/latest-date');
      const data = await response.json();
      if (data.date) {
        set({ dataDate: data.date });
      }
      // 获取所有可用日期
      const datesResponse = await fetch('/api/data/dates');
      const datesData = await datesResponse.json();
      if (datesData.dates) {
        set({ availableDates: datesData.dates });
      }
    } catch (error) {
      console.error('Failed to initialize app store:', error);
    }
  },
}));
