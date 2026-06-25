'use client';

import { useEffect, useState } from 'react';
import { formatPercentage } from '@/lib/stats';
import { STRATEGY_NAME_MAP } from '@/lib/types';
import { X, ArrowUpDown } from 'lucide-react';

interface WeeklyDetailTableProps {
  strategyType: string;
  dataDate: string;
  onClose: () => void;
}

interface WeeklyDetail {
  fundManager: string;
  productName: string;
  weeklyReturn: number | null;
}

export default function WeeklyDetailTable({ strategyType, dataDate, onClose }: WeeklyDetailTableProps) {
  const [details, setDetails] = useState<WeeklyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'weeklyReturn'>('weeklyReturn');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchDetails();
  }, [strategyType, dataDate]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/strategies/${strategyType}/weekly-details?dataDate=${dataDate}`
      );
      const data = await response.json();
      setDetails(data.details || []);
    } catch (error) {
      console.error('Failed to fetch weekly details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'weeklyReturn') => {
    if (sortBy === field) {
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
  };

  const sortedDetails = [...details].sort((a, b) => {
    const aVal = a[sortBy] ?? -Infinity;
    const bVal = b[sortBy] ?? -Infinity;
    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden animate-fade-in shadow-xl">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-dark-border">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500 animate-pulse shrink-0" />
          <h3 className="text-sm font-semibold text-dark-text truncate">
            <span className="hidden sm:inline">{STRATEGY_NAME_MAP[strategyType]} - 近一周收益明细</span>
            <span className="sm:hidden">{STRATEGY_NAME_MAP[strategyType]}</span>
          </h3>
          <span className="text-xs text-dark-textDim font-mono bg-dark-bg/50 px-2 py-0.5 rounded border border-dark-border shrink-0">
            {details.length} 条
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-red-500/10 rounded-lg transition-all duration-200 text-dark-textDim hover:text-red-400 hover:rotate-90 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-bg/50 border-b border-dark-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-dark-textDim text-xs whitespace-nowrap">基金管理人</th>
                  <th className="px-4 py-3 text-left font-medium text-dark-textDim text-xs whitespace-nowrap">产品名称</th>
                  <th
                    className="px-4 py-3 text-right font-medium text-dark-textDim text-xs cursor-pointer hover:text-cyan-400 transition-colors select-none whitespace-nowrap"
                    onClick={() => handleSort('weeklyReturn')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      近一周收益
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDetails.map((detail, index) => (
                  <tr
                    key={index}
                    className="border-b border-dark-border/50 hover:bg-cyan-400/5 transition-all duration-200 animate-slide-in"
                    style={{ animationDelay: `${Math.min(index * 20, 500)}ms`, animationFillMode: 'both' }}
                  >
                    <td className="px-4 py-2.5 text-dark-text text-xs whitespace-nowrap">{detail.fundManager}</td>
                    <td className="px-4 py-2.5 text-dark-text text-xs font-medium whitespace-nowrap">{detail.productName}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span
                        className={`text-xs font-mono font-medium ${
                          (detail.weeklyReturn ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'
                        }`}
                      >
                        {formatPercentage(detail.weeklyReturn)}
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
                className="flex items-center justify-between px-3 py-3 border-b border-dark-border/50 hover:bg-cyan-400/5 transition-all duration-200 animate-slide-in"
                style={{ animationDelay: `${Math.min(index * 20, 500)}ms`, animationFillMode: 'both' }}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="text-dark-text text-xs font-medium break-words">{detail.productName}</div>
                  <div className="text-dark-textMuted text-[10px] mt-0.5 truncate">{detail.fundManager}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`text-xs font-mono font-medium ${
                      (detail.weeklyReturn ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {formatPercentage(detail.weeklyReturn)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {details.length === 0 && (
            <div className="text-center py-12 text-dark-textDim text-sm">暂无数据</div>
          )}
        </>
      )}
    </div>
  );
}
