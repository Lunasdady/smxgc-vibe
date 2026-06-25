'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { STRATEGY_NAME_MAP, GroupSummary, FundProduct } from '@/lib/types';
import { formatPercentage } from '@/lib/stats';
import Sidebar from '@/components/Sidebar';
import DateSelector from '@/components/DateSelector';
import { Menu, Search, ChevronLeft, ChevronRight, ArrowUpDown, BarChart3 } from 'lucide-react';
import Link from 'next/link';

const DATA_COLUMNS: { key: keyof FundProduct; label: string }[] = [
  { key: 'weeklyReturn', label: '近一周收益' },
  { key: 'monthlyReturn', label: '近一月收益' },
  { key: 'ytdReturn', label: '今年以来收益' },
  { key: 'annualizedReturnSinceInception', label: '成立以来年化' },
  { key: 'ytdMaxDrawdown', label: '今年最大回撤' },
  { key: 'inceptionMaxDrawdown', label: '成立最大回撤' },
  { key: 'annualizedVolatility', label: '年化波动率' },
  { key: 'sharpeRatio', label: '夏普比率' },
];

interface StrategyPageProps {
  params: {
    type: string;
  };
}

export default function StrategyPage({ params }: StrategyPageProps) {
  const { dataDate, initialize } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [groupSummary, setGroupSummary] = useState<GroupSummary | null>(null);
  const [products, setProducts] = useState<FundProduct[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof FundProduct>('weeklyReturn');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileColumn, setMobileColumn] = useState<keyof FundProduct>('weeklyReturn');
  const pageSize = 20;

  const strategyType = params.type;
  const strategyName = STRATEGY_NAME_MAP[strategyType] || strategyType;

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (dataDate) {
      fetchData();
    }
  }, [dataDate, strategyType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, productsRes] = await Promise.all([
        fetch(`/api/strategies/${strategyType}/group-summary?dataDate=${dataDate}`),
        fetch(`/api/strategies/${strategyType}/products?dataDate=${dataDate}&page=1&limit=1000`),
      ]);
      const summaryData = await summaryRes.json();
      const productsData = await productsRes.json();
      setGroupSummary(summaryData);
      setProducts(productsData.products || []);
    } catch (error) {
      console.error('Failed to fetch strategy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof FundProduct) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredProducts = products
    .filter((p) => p.fundManager.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      }
      return String(aVal).localeCompare(String(bVal));
    });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="min-h-screen bg-dark-bg overflow-x-hidden">
      {/* Header */}
      <header className="bg-dark-card/80 backdrop-blur-md border-b border-dark-border sticky top-0 z-30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-2 sm:py-3 gap-2 sm:gap-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-dark-cardHover transition-colors text-dark-textMuted"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="p-1.5 rounded-lg hover:bg-dark-cardHover transition-colors text-dark-textDim hover:text-dark-text shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-dark-text tracking-wide truncate">
                  {strategyName}
                </h1>
                <p className="text-xs text-dark-textDim hidden sm:block">策略详情</p>
              </div>
            </div>
          </div>
          <div className="flex-1 sm:flex-none sm:w-48">
            <DateSelector />
          </div>
        </div>
      </header>

      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 md:ml-64 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  <p className="text-sm text-dark-textDim">加载数据中...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Strategy Title */}
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                    <div>
                      <h1 className="text-xl font-bold text-dark-text tracking-wide">{strategyName}</h1>
                      <p className="text-xs text-dark-textDim mt-0.5">策略详情 · {filteredProducts.length} 只产品</p>
                    </div>
                  </div>
                </div>

                {/* Group Box Plots */}
                {groupSummary && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <BoxPlotCard
                      title="100亿元以上"
                      stats={groupSummary.largeScale}
                    />
                    <BoxPlotCard
                      title="100亿以下"
                      stats={groupSummary.smallScale}
                    />
                  </div>
                )}

                {/* Products Table */}
                <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-dark-border">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-5 rounded-full bg-cyan-400" />
                      <h3 className="text-sm font-semibold text-dark-text">
                        产品数据明细表
                      </h3>
                      <span className="text-xs text-dark-textDim font-mono bg-dark-bg px-2 py-0.5 rounded">
                        {filteredProducts.length} 条
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-textDim pointer-events-none" />
                      <input
                        type="text"
                        placeholder="搜索基金管理人..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-8 pr-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder-dark-textDim focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/50 transition-all w-56"
                      />
                    </div>
                  </div>

                  {/* Mobile Column Selector */}
                  <div className="sm:hidden border-b border-dark-border bg-dark-bg/30">
                    <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                      {DATA_COLUMNS.map((col) => (
                        <button
                          key={col.key}
                          onClick={() => {
                            setMobileColumn(col.key);
                            handleSort(col.key);
                          }}
                          className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all duration-200 ${
                            mobileColumn === col.key
                              ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/40 font-medium'
                              : 'text-dark-textDim border border-dark-border hover:border-cyan-400/30 hover:text-dark-text'
                          }`}
                        >
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block">
                    <table className="w-full text-xs table-fixed">
                      <colgroup>
                        <col className="w-[110px]" />
                        <col className="w-[90px]" />
                        <col className="w-[180px]" />
                        <col className="w-[90px]" />
                        <col className="w-[88px]" />
                        <col className="w-[88px]" />
                        <col className="w-[98px]" />
                        <col className="w-[98px]" />
                        <col className="w-[98px]" />
                        <col className="w-[98px]" />
                        <col className="w-[88px]" />
                        <col className="w-[78px]" />
                      </colgroup>
                      <thead className="bg-dark-bg/50 border-b border-dark-border">
                        <tr>
                          <th className="px-3 py-3 text-left font-medium text-dark-textDim whitespace-nowrap">基金管理人</th>
                          <th className="px-3 py-3 text-left font-medium text-dark-textDim whitespace-nowrap">管理人规模</th>
                          <th className="px-3 py-3 text-left font-medium text-dark-textDim whitespace-nowrap">产品名称</th>
                          <th className="px-3 py-3 text-left font-medium text-dark-textDim whitespace-nowrap">策略分类</th>
                          <SortableHeader field="weeklyReturn" currentSort={sortBy} onSort={handleSort}>近一周收益</SortableHeader>
                          <SortableHeader field="monthlyReturn" currentSort={sortBy} onSort={handleSort}>近一月收益</SortableHeader>
                          <SortableHeader field="ytdReturn" currentSort={sortBy} onSort={handleSort}>今年以来收益</SortableHeader>
                          <SortableHeader field="annualizedReturnSinceInception" currentSort={sortBy} onSort={handleSort}>成立以来年化</SortableHeader>
                          <SortableHeader field="ytdMaxDrawdown" currentSort={sortBy} onSort={handleSort}>今年最大回撤</SortableHeader>
                          <SortableHeader field="inceptionMaxDrawdown" currentSort={sortBy} onSort={handleSort}>成立最大回撤</SortableHeader>
                          <SortableHeader field="annualizedVolatility" currentSort={sortBy} onSort={handleSort}>年化波动率</SortableHeader>
                          <SortableHeader field="sharpeRatio" currentSort={sortBy} onSort={handleSort}>夏普比率</SortableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((product, index) => (
                          <tr
                            key={product.id}
                            className="border-b border-dark-border/50 hover:bg-cyan-400/5 transition-all duration-200 animate-slide-in"
                            style={{ animationDelay: `${Math.min(index * 30, 600)}ms`, animationFillMode: 'both' }}
                          >
                            <td className="px-3 py-2.5 text-dark-text whitespace-nowrap">{product.fundManager}</td>
                            <td className="px-3 py-2.5 text-dark-textMuted whitespace-nowrap">{product.managerScale}</td>
                            <td className="px-3 py-2.5 text-dark-text font-medium whitespace-nowrap">{product.productName}</td>
                            <td className="px-3 py-2.5 text-dark-textMuted whitespace-nowrap">{product.strategyCategory || '-'}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{renderCell(product.weeklyReturn)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{renderCell(product.monthlyReturn)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{renderCell(product.ytdReturn)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{renderCell(product.annualizedReturnSinceInception)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{renderCell(product.ytdMaxDrawdown)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{renderCell(product.inceptionMaxDrawdown)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{renderCell(product.annualizedVolatility)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{product.sharpeRatio?.toFixed(2) ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile List */}
                  <div className="sm:hidden">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-dark-border bg-dark-bg/50 text-xs">
                      <span className="font-medium text-dark-textDim">产品名称</span>
                      <span className="font-medium text-dark-textDim cursor-pointer select-none flex items-center gap-1" onClick={() => handleSort(mobileColumn)}>
                        {DATA_COLUMNS.find(c => c.key === mobileColumn)?.label}
                        {sortBy === mobileColumn && <ArrowUpDown className="w-3 h-3" />}
                      </span>
                    </div>
                    {paginatedProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between px-3 py-3 border-b border-dark-border/50 hover:bg-cyan-400/5 transition-all duration-200 animate-slide-in"
                        style={{ animationDelay: `${Math.min(index * 30, 600)}ms`, animationFillMode: 'both' }}
                      >
                        <div className="flex-1 min-w-0 pr-3 text-dark-text font-medium text-xs break-words">{product.productName}</div>
                        <div className="shrink-0 text-right">{renderMobileCell(product, mobileColumn)}</div>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="text-center py-12 text-dark-textDim text-sm">暂无数据</div>
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center px-5 py-3 border-t border-dark-border">
                      <span className="text-xs text-dark-textDim">
                        共 {filteredProducts.length} 条数据
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-dark-border hover:bg-dark-cardHover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-dark-textMuted"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-dark-textMuted px-2 font-mono">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg border border-dark-border hover:bg-dark-cardHover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-dark-textMuted"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SortableHeader({
  field,
  currentSort,
  onSort,
  children,
}: {
  field: string;
  currentSort: string;
  onSort: (field: any) => void;
  children: React.ReactNode;
}) {
  return (
    <th
      className="px-3 py-3 text-right font-medium text-dark-textDim whitespace-nowrap cursor-pointer hover:text-cyan-400 transition-colors select-none hidden sm:table-cell"
      onClick={() => onSort(field as any)}
    >
      <span className="flex items-center justify-end gap-1">
        {children}
        {currentSort === field && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </th>
  );
}

function renderCell(value: number | null): React.ReactNode {
  if (value === null) return <span className="text-dark-textDim">-</span>;
  const isPositive = value >= 0;
  return (
    <span className={`font-mono font-medium ${isPositive ? 'text-red-400' : 'text-green-400'}`}>
      {formatPercentage(value)}
    </span>
  );
}

function renderMobileCell(product: FundProduct, field: keyof FundProduct): React.ReactNode {
  const value = product[field];
  if (field === 'sharpeRatio') {
    return <span className="font-mono font-medium text-dark-text">{typeof value === 'number' ? value.toFixed(2) : '-'}</span>;
  }
  if (typeof value === 'number') {
    return renderCell(value);
  }
  return <span className="text-dark-textDim">-</span>;
}

// Box Plot Card for group summary
function BoxPlotCard({ title, stats }: { title: string; stats: any }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  if (stats.count === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-dark-text mb-4">{title}</h3>
        <div className="text-center py-8 text-dark-textDim text-sm">暂无数据</div>
      </div>
    );
  }

  const chartWidth = 280;
  const chartHeight = 100;
  const padding = 20;

  const dataMin = stats.min ?? 0;
  const dataMax = stats.max ?? 0;
  const range = dataMax - dataMin || 1;

  const mapX = (value: number | null) => {
    if (value === null) return null;
    return padding + ((value - dataMin) / range) * (chartWidth - padding * 2);
  };

  const yCenter = chartHeight / 2;
  const boxHeight = 30;
  const whiskerHeight = 14;

  const xMin = mapX(dataMin);
  const xQ25 = mapX(stats.q25);
  const xMean = mapX(stats.mean);
  const xQ75 = mapX(stats.q75);
  const xMax = mapX(dataMax);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const tooltipWidth = 160;
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      setTooltip({
        x: Math.max(0, Math.min(rawX + 12, rect.width - tooltipWidth)),
        y: Math.max(0, rawY - 70),
        visible: true,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ x: 0, y: 0, visible: false });
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-cyan-400/40 transition-all duration-300 card-hover">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-text flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {title}
        </h3>
        <span className="text-xs text-dark-textDim font-mono bg-dark-bg/50 px-2 py-0.5 rounded">{stats.count} 只</span>
      </div>
      <div className="relative overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="boxGradient-${title}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <line
            x1={padding}
            y1={yCenter}
            x2={chartWidth - padding}
            y2={yCenter}
            stroke="#2A3447"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {xMin !== null && xQ25 !== null && (
            <>
              <line x1={xMin} y1={yCenter} x2={xQ25} y2={yCenter} stroke="#64748B" strokeWidth="1.5" />
              <line x1={xMin} y1={yCenter - whiskerHeight / 2} x2={xMin} y2={yCenter + whiskerHeight / 2} stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          {xMax !== null && xQ75 !== null && (
            <>
              <line x1={xQ75} y1={yCenter} x2={xMax} y2={yCenter} stroke="#64748B" strokeWidth="1.5" />
              <line x1={xMax} y1={yCenter - whiskerHeight / 2} x2={xMax} y2={yCenter + whiskerHeight / 2} stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          {xQ25 !== null && xQ75 !== null && (
            <rect
              x={xQ25}
              y={yCenter - boxHeight / 2}
              width={Math.max(xQ75 - xQ25, 2)}
              height={boxHeight}
              fill="rgba(34, 211, 238, 0.15)"
              stroke={`url(#boxGradient-${title})`}
              strokeWidth="1.5"
              rx="2"
            />
          )}
          {xQ25 !== null && xQ75 !== null && (
            <line
              x1={(xQ25 + xQ75) / 2}
              y1={yCenter - boxHeight / 2}
              x2={(xQ25 + xQ75) / 2}
              y2={yCenter + boxHeight / 2}
              stroke="#22d3ee"
              strokeWidth="2"
            />
          )}
          {xMean !== null && (
            <circle cx={xMean} cy={yCenter} r="5" fill="#f87171" stroke="#0B0F19" strokeWidth="2" />
          )}
        </svg>
        
        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 pointer-events-none transition-opacity duration-150"
            style={{
              left: tooltip.x,
              top: tooltip.y,
            }}
          >
            <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-md border border-cyan-400/30 rounded-xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-full max-w-[160px]">
              <div className="text-xs font-semibold text-cyan-300 mb-2 pb-2 border-b border-slate-600/50 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {title}
              </div>
              <div className="space-y-1.5">
                <TooltipRow label="最大值" value={stats.max} showIndicator />
                <TooltipRow label="75分位" value={stats.q75} />
                <TooltipRow label="平均数" value={stats.mean} isMean showIndicator />
                <TooltipRow label="25分位" value={stats.q25} />
                <TooltipRow label="最小值" value={stats.min} showIndicator />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-dark-textDim">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />中位数
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />均值
        </span>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  isMean,
  showIndicator,
}: {
  label: string;
  value: number | null;
  isMean?: boolean;
  showIndicator?: boolean;
}) {
  const colorClass =
    value === null
      ? 'text-slate-500'
      : value >= 0
      ? 'text-red-400'
      : 'text-green-400';

  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-400 flex items-center gap-2">
        {showIndicator && (
          <span className={`w-1 h-1 rounded-full ${value === null ? 'bg-slate-600' : value >= 0 ? 'bg-red-400' : 'bg-green-400'}`} />
        )}
        {label}
      </span>
      <span className={`font-mono font-medium ${colorClass} ${isMean ? 'font-bold tracking-wide' : ''}`}>
        {formatPercentage(value)}
      </span>
    </div>
  );
}
