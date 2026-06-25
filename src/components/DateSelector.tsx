'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import dayjs from 'dayjs';
import { Calendar } from 'lucide-react';

export default function DateSelector() {
  const { dataDate, availableDates, setDataDate, setAvailableDates } = useAppStore();

  useEffect(() => {
    fetchDates();
  }, []);

  const fetchDates = async () => {
    try {
      const response = await fetch('/api/data/dates');
      const data = await response.json();
      if (data.dates) {
        setAvailableDates(data.dates);
      }
    } catch (error) {
      console.error('Failed to fetch dates:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDataDate(e.target.value);
  };

  return (
    <div className="w-full">
      <label className="hidden sm:block text-[10px] font-semibold text-dark-textDim uppercase tracking-wider mb-1.5">
        数据日期
      </label>
      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-textDim pointer-events-none" />
        <select
          value={dataDate || ''}
          onChange={handleChange}
          className="w-full pl-8 pr-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/50 transition-all appearance-none cursor-pointer hover:border-dark-border/80"
        >
          {availableDates.length === 0 ? (
            <option value="">暂无数据</option>
          ) : (
            availableDates.map((date) => (
              <option key={date} value={date} className="bg-dark-card text-dark-text">
                {dayjs(date).format('YYYY-MM-DD')}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
}
