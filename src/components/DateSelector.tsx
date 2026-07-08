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
    <div className="relative">
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
      <select
        value={dataDate || ''}
        onChange={handleChange}
        className="pl-9 pr-8 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-full text-[14px] text-[#1D1D1F] font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-all appearance-none cursor-pointer hover:border-[#0000001A] hover:bg-[#FAFAFA] transition-all duration-300 ease-apple"
      >
        {availableDates.length === 0 ? (
          <option value="">暂无数据</option>
        ) : (
          availableDates.map((date) => (
            <option key={date} value={date} className="bg-white text-[#1D1D1F]">
              {dayjs(date).format('YYYY-MM-DD')}
            </option>
          ))
        )}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
