'use client';

import { useEffect, useState } from 'react';
import { formatValue } from '@/lib/stats';
import { STRATEGY_NAME_MAP, METRIC_FIELDS } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { X, ArrowUpDown } from 'lucide-react';

interface WeeklyDetailTableProps {
  strategyType: string;
  dataDate: string;
  onClose: () => void;
}

interface WeeklyDetail {
  fundManager: string;
  productName: string;
  value: number | null;
}

export default function WeeklyDetailTable({ strategyType, dataDate, onClose }: WeeklyDetailTableProps) {
  const { metric } = useAppStore();
  const [details, setDetails] = useState<WeeklyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');

  const currentMetric = METRIC_FIELDS.find(m => m.key === metric) || METRIC_FIELDS[0];

  useEffect(() => {
    fetchDetails();
  }, [strategyType, dataDate, metric]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/strategies/${strategyType}/weekly-details?dataDate=${dataDate}&metric=${metric}`
      );
      const data = await response.json();
      setDetails(data.details || []);
    } catch (error) {
      console.error('Failed to fetch weekly details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = () => {
    setOrder(order === 'desc' ? 'asc' : 'desc');
  };

  const sortedDetails = [...details].sort((a, b) => {
    const aVal = a.value ?? -Infinity;
    const bVal = b.value ?? -Infinity;
    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return (
    <div className="glass-card rounded-3xl overflow-hidden shadow-apple">
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-[#0000000D]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1 h-6 rounded-full bg-[#0071E3] shrink-0" />
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] truncate">
            <span className="hidden sm:inline">{STRATEGY_NAME_MAP[strategyType]} · {currentMetric.label}</span>
            <span className="sm:hidden">{STRATEGY_NAME_MAP[strategyType]}</span>
          </h3>
          <span className="text-[12px] text-[#86868B] font-medium px-2.5 py-0.5 rounded-full bg-[#00000006] shrink-0">
            {details.length} 条
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#00000008] rounded-xl transition-all duration-300 ease-apple text-[#86868B] hover:text-[#1D1D1F] hover:rotate-90 shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#00000004]">
                <tr>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">基金管理人</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">产品名称</th>
                  <th
                    className="px-5 py-3 text-right text-[13px] font-medium text-[#86868B] cursor-pointer hover:text-[#0071E3] transition-colors select-none whitespace-nowrap"
                    onClick={() => handleSort()}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      {currentMetric.label}
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDetails.map((detail, index) => (
                  <tr
                    key={index}
                    className="border-b border-[#00000008] hover:bg-[#0071E3]/[0.02] transition-all duration-200"
                  >
                    <td className="px-5 py-3 text-[14px] text-[#1D1D1F] whitespace-nowrap">{detail.fundManager}</td>
                    <td className="px-5 py-3 text-[14px] text-[#1D1D1F] font-medium whitespace-nowrap">{detail.productName}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <span
                        className={`text-[14px] font-semibold ${
                          (detail.value ?? 0) >= 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                        }`}
                      >
                        {formatValue(detail.value, currentMetric.isPercentage)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="sm:hidden">
            {sortedDetails.map((detail, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-3.5 border-b border-[#00000008] hover:bg-[#0071E3]/[0.02] transition-all duration-200"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="text-[14px] text-[#1D1D1F] font-medium truncate">{detail.productName}</div>
                  <div className="text-[12px] text-[#86868B] mt-0.5 truncate">{detail.fundManager}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`text-[14px] font-semibold ${
                      (detail.value ?? 0) >= 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                    }`}
                  >
                    {formatValue(detail.value, currentMetric.isPercentage)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {details.length === 0 && (
            <div className="text-center py-12 text-[#86868B] text-[15px]">暂无数据</div>
          )}
        </>
      )}
    </div>
  );
}
