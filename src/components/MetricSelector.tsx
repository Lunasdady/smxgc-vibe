'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { getMetricFields } from '@/lib/types';
import { SlidersHorizontal } from 'lucide-react';

interface MetricSelectorProps {
  strategyType?: string | null; // 可选的策略类型
}

export default function MetricSelector({ strategyType = null }: MetricSelectorProps) {
  const { dataDate, metric, setMetric } = useAppStore();
  
  // 根据日期和策略类型动态获取指标字段
  const metricFields = getMetricFields(dataDate, strategyType);
  
  // 当日期或策略类型变化时，检查当前 metric 是否有效
  useEffect(() => {
    const isValid = metricFields.some(m => m.key === metric);
    if (!isValid && metricFields.length > 0) {
      // 如果当前 metric 不在新字段中，切换到第一个
      setMetric(metricFields[0].key);
    }
  }, [dataDate, strategyType, metricFields]);

  return (
    <div className="relative">
      <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
      <select
        value={metric}
        onChange={(e) => setMetric(e.target.value)}
        className="pl-9 pr-8 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-full text-[14px] text-[#1D1D1F] font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-all appearance-none cursor-pointer hover:border-[#0000001A] hover:bg-[#FAFAFA] transition-all duration-300 ease-apple"
      >
        {metricFields.map((m) => (
          <option key={m.key} value={m.key} className="bg-white text-[#1D1D1F]">
            {m.label}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
