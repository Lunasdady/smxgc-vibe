'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/lib/store';
import { STRATEGY_NAME_MAP, GroupSummary, FundProduct, getMetricFields, FUTURES_CUTOFF_DATE, OLD_FUTURES_STRATEGIES, NEW_CTA_STRATEGIES } from '@/lib/types';
import { formatValue } from '@/lib/stats';
import DateSelector from '@/components/DateSelector';
import MetricSelector from '@/components/MetricSelector';
import Navbar from '@/components/Navbar';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Maximize2, Minimize2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useAccessLog } from '@/hooks/useAccessLog';

interface StrategyPageProps {
  params: {
    type: string;
  };
}

export default function StrategyPage({ params }: StrategyPageProps) {
  const router = useRouter();
  useAccessLog(`/strategy/${params.type}`);
  const { dataDate, metric, initialize } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [groupSummary, setGroupSummary] = useState<GroupSummary | null>(null);
  const [products, setProducts] = useState<FundProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof FundProduct>('weeklyReturn');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileColumn, setMobileColumn] = useState<keyof FundProduct>('weeklyReturn');
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);
  const pageSize = 20;

  // 只初始化一次
  const initializedRef = useRef(false);

  const strategyType = params.type;

  // 使用动态指标字段
  const metricFields = getMetricFields(dataDate, strategyType);
  // 策略详情页使用自己策略类型对应的 metric，而不是 store 中的全局 metric
  const currentMetric = metricFields.find(m => m.key === metric) || metricFields[0];
  const actualMetric = currentMetric?.key || 'weeklyReturn';

  // 根据日期动态计算实际显示的策略名称
  const getActualStrategyName = () => {
    if (!dataDate) return STRATEGY_NAME_MAP[strategyType] || strategyType;
    
    const date = new Date(dataDate);
    const cutoffDate = new Date(FUTURES_CUTOFF_DATE);
    
    // 如果访问的是新CTA策略但日期在截止日前，显示旧期货名称
    if (date < cutoffDate && NEW_CTA_STRATEGIES.includes(strategyType)) {
      if (strategyType === 'subjective-cta') return STRATEGY_NAME_MAP['subjective-futures'];
      if (strategyType === 'quantitative-cta') return STRATEGY_NAME_MAP['quantitative-futures'];
      if (strategyType === 'composite-cta') return '复合CTA（历史无数据）';
    }
    // 如果访问的是旧期货策略但日期在截止日后，显示新CTA名称
    if (date >= cutoffDate && OLD_FUTURES_STRATEGIES.includes(strategyType)) {
      if (strategyType === 'subjective-futures') return STRATEGY_NAME_MAP['subjective-cta'];
      if (strategyType === 'quantitative-futures') return STRATEGY_NAME_MAP['quantitative-cta'];
    }
    
    return STRATEGY_NAME_MAP[strategyType] || strategyType;
  };
  
  const strategyName = getActualStrategyName();

  // 当日期或策略类型变化时，重置排序字段为当前指标字段列表的第一个
  useEffect(() => {
    const defaultField = metricFields[0]?.key as keyof FundProduct || 'weeklyReturn';
    setSortBy(defaultField);
    setMobileColumn(defaultField);
    setCurrentPage(1);
  }, [dataDate, strategyType, metricFields]);
  
  // 动态数据列（根据日期和策略类型生成）
  const DATA_COLUMNS: { key: keyof FundProduct; label: string }[] = metricFields.map((field: { key: string; label: string; isPercentage: boolean }) => ({
    key: field.key as keyof FundProduct,
    label: field.label,
  }));

  // Scroll reveal hooks
  const headerReveal = useScrollReveal();
  const boxPlotReveal = useScrollReveal();
  const tableReveal = useScrollReveal();

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      initialize();
    }
  }, [initialize]);

  // 即时权限检查：页面加载后立即验证数据库最新权限
  useEffect(() => {
    const checkPermission = async () => {
      const tokenMatch = document.cookie.match(/user-token=([^;]+)/);
      if (!tokenMatch) return;
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${tokenMatch[1]}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status !== 'approved' || !data.permissions?.includes('strategy-detail')) {
            router.push('/login?error=no-permission');
          }
        }
      } catch {
        // ignore
      }
    };
    checkPermission();
  }, [router]);

  useEffect(() => {
    if (!dataDate) return;
    
    const controller = new AbortController();
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryRes, productsRes] = await Promise.all([
          fetch(`/api/strategies/${strategyType}/group-summary?dataDate=${dataDate}&metric=${actualMetric}`, {
            signal: controller.signal
          }),
          fetch(`/api/strategies/${strategyType}/products?dataDate=${dataDate}&page=1&limit=1000`, {
            signal: controller.signal
          }),
        ]);
        // 权限被撤销时重定向
        if (summaryRes.status === 403 || productsRes.status === 403) {
          router.push('/login?error=no-permission');
          return;
        }
        const summaryData = await summaryRes.json();
        const productsData = await productsRes.json();
        setGroupSummary(summaryData);
        setProducts(productsData.products || []);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch strategy data:', error);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    return () => controller.abort();
  }, [dataDate, strategyType, actualMetric]);

  // Force reveal after data loads (same as homepage fix)
  useEffect(() => {
    if (!loading && groupSummary) {
      requestAnimationFrame(() => {
        boxPlotReveal.forceReveal();
        tableReveal.forceReveal();
      });
    }
  }, [loading, groupSummary]);

  const fetchData = async (metricToFetch: string) => {
    setLoading(true);
    try {
      const [summaryRes, productsRes] = await Promise.all([
        fetch(`/api/strategies/${strategyType}/group-summary?dataDate=${dataDate}&metric=${metricToFetch}`),
        fetch(`/api/strategies/${strategyType}/products?dataDate=${dataDate}&page=1&limit=1000`),
      ]);
      // 权限被撤销时重定向
      if (summaryRes.status === 403 || productsRes.status === 403) {
        router.push('/login?error=no-permission');
        return;
      }
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
    <div className="min-h-screen bg-[#F5F5F7]">
      <Navbar />
      <div className="h-14" />

      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12">
        {/* Breadcrumb & Title */}
        <div ref={headerReveal.ref} className={`mb-10 scroll-reveal ${headerReveal.revealed ? 'revealed' : ''}`}>
          <div className="flex items-center gap-2 text-[13px] text-[#86868B] mb-4">
            <Link href="/" className="hover:text-[#0071E3] transition-colors">
              概况
            </Link>
            <ChevronLeft className="w-3 h-3 rotate-180" />
            <span className="text-[#1D1D1F] font-medium">{strategyName}</span>
          </div>
          <h1 className="section-title text-[#1D1D1F] mb-2">{strategyName}</h1>
          <p className="text-[17px] text-[#86868B]">{filteredProducts.length} 只产品 · {currentMetric.label}</p>
        </div>

        {/* Controls Bar - moved above box plots */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-[20px] font-semibold text-[#1D1D1F] tracking-tight">规模分布对比</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <MetricSelector strategyType={strategyType} />
            <DateSelector />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
              <p className="text-[15px] text-[#86868B]">加载数据中...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Group Box Plots */}
            {groupSummary && (
              <div ref={boxPlotReveal.ref} className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 scroll-reveal ${boxPlotReveal.revealed ? 'revealed' : ''}`}>
                <BoxPlotCard
                  title="100亿元以上"
                  stats={groupSummary.largeScale}
                  metricName={currentMetric.label}
                  isPercentage={currentMetric.isPercentage}
                />
                <BoxPlotCard
                  title="100亿以下"
                  stats={groupSummary.smallScale}
                  metricName={currentMetric.label}
                  isPercentage={currentMetric.isPercentage}
                />
              </div>
            )}

            {/* Products Table */}
            <div ref={tableReveal.ref} className={`scroll-reveal ${tableReveal.revealed ? 'revealed' : ''}`}>
              {/* Controls Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#0000000D]">
                <h2 className="text-[24px] font-semibold text-[#1D1D1F] tracking-tight">产品明细</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="搜索基金管理人..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-9 pr-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-full text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-all w-56 hover:border-[#0000001A]"
                    />
                  </div>
                  <button
                    onClick={() => setIsTableFullscreen(true)}
                    className="p-2 rounded-xl bg-[#FFFFFF] border border-[#0000000D] hover:bg-[#00000006] transition-all duration-200 group"
                    title="全屏查看"
                  >
                    <Maximize2 className="w-4 h-4 text-[#86868B] group-hover:text-[#1D1D1F] transition-colors" />
                  </button>
                </div>
              </div>
            <div className="glass-card rounded-3xl overflow-hidden shadow-apple">
              {/* Mobile Column Selector */}
              <div className="sm:hidden border-b border-[#0000000D] px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {DATA_COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => {
                        setMobileColumn(col.key);
                        handleSort(col.key);
                      }}
                      className={`px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-all duration-300 ease-apple ${
                        mobileColumn === col.key
                          ? 'bg-[#0071E3] text-white font-medium'
                          : 'bg-[#00000006] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#0000000A]'
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#00000004]">
                    <tr>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">基金管理人</th>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">管理人规模</th>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap sticky left-0 z-10 bg-[#FAFAFB]">产品名称</th>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">策略分类</th>
                      {DATA_COLUMNS.map((col) => (
                        <SortableHeader key={col.key} field={col.key} currentSort={sortBy} onSort={handleSort}>
                          {col.label}
                        </SortableHeader>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-[#00000008] hover:bg-[#0071E3]/[0.02] transition-all duration-200"
                      >
                        <td className="px-5 py-3 text-[14px] text-[#1D1D1F] whitespace-nowrap">{product.fundManager}</td>
                        <td className="px-5 py-3 text-[14px] text-[#86868B] whitespace-nowrap">{product.managerScale}</td>
                        <td className="px-5 py-3 text-[14px] text-[#1D1D1F] font-medium whitespace-nowrap sticky left-0 z-10 bg-white">{product.productName}</td>
                        <td className="px-5 py-3 text-[14px] text-[#86868B] whitespace-nowrap">{product.strategyCategory || '-'}</td>
                        {DATA_COLUMNS.map((col) => (
                          <td key={col.key} className="px-5 py-3 text-right whitespace-nowrap">
                            {renderCell(product[col.key] as number, col.key !== 'sharpeRatio' && col.key !== 'excessSharpeRatio' && col.key !== 'karmaRatio')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="sm:hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#0000000D] text-[13px]">
                  <span className="font-medium text-[#86868B]">产品名称</span>
                  <span className="font-medium text-[#86868B] cursor-pointer select-none flex items-center gap-1.5" onClick={() => handleSort(mobileColumn)}>
                    {DATA_COLUMNS.find(c => c.key === mobileColumn)?.label}
                    {sortBy === mobileColumn && <ArrowUpDown className="w-3.5 h-3.5" />}
                  </span>
                </div>
                {paginatedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between px-4 py-3.5 border-b border-[#00000008]"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="text-[14px] text-[#1D1D1F] font-medium truncate">{product.productName}</div>
                      <div className="text-[12px] text-[#86868B] mt-0.5">{product.fundManager} · {product.managerScale}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {renderMobileCell(product, mobileColumn)}
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-[#86868B] text-[15px]">暂无数据</div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-5 py-4 border-t border-[#0000000D]">
                  <span className="text-[13px] text-[#86868B]">
                    共 {filteredProducts.length} 条数据
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-[#0000000D] hover:bg-[#00000008] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 text-[#86868B]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[13px] text-[#86868B] px-3 font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-[#0000000D] hover:bg-[#00000008] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 text-[#86868B]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          </>
        )}
      </main>

      {/* Fullscreen Table Modal */}
      {isTableFullscreen && createPortal(
        <div className="fixed inset-0 z-[100] bg-[#F5F5F7] overflow-auto">
          <div className="sticky top-0 z-10 glass-card border-b border-[#0000000D] backdrop-blur-xl bg-[#F5F5F7]/90">
            <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-[#1D1D1F] tracking-tight">{strategyName} - 产品明细</h2>
                <p className="text-[13px] text-[#86868B] mt-1">{filteredProducts.length} 只产品 · {currentMetric.label}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="搜索基金管理人..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-full text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-all w-56 hover:border-[#0000001A]"
                  />
                </div>
                <button
                  onClick={() => setIsTableFullscreen(false)}
                  className="p-2 rounded-xl bg-[#FFFFFF] border border-[#0000000D] hover:bg-[#00000006] transition-all duration-200 group"
                  title="退出全屏"
                >
                  <Minimize2 className="w-4 h-4 text-[#86868B] group-hover:text-[#1D1D1F] transition-colors" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
            <div className="glass-card rounded-3xl overflow-hidden shadow-apple">
              <div className="overflow-x-auto" style={{ minWidth: '1400px' }}>
                <table className="w-full">
                  <thead className="bg-[#00000004]">
                    <tr>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">基金管理人</th>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">管理人规模</th>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap sticky left-0 z-10 bg-[#FAFAFB]">产品名称</th>
                      <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B] whitespace-nowrap">策略分类</th>
                      {DATA_COLUMNS.map((col) => (
                        <th key={col.key} className="px-5 py-3 text-right text-[13px] font-medium text-[#86868B] whitespace-nowrap">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-[#00000008] hover:bg-[#0071E3]/[0.02] transition-all duration-200"
                      >
                        <td className="px-5 py-3 text-[14px] text-[#1D1D1F] whitespace-nowrap">{product.fundManager}</td>
                        <td className="px-5 py-3 text-[14px] text-[#86868B] whitespace-nowrap">{product.managerScale}</td>
                        <td className="px-5 py-3 text-[14px] text-[#1D1D1F] font-medium whitespace-nowrap sticky left-0 z-10 bg-white">{product.productName}</td>
                        <td className="px-5 py-3 text-[14px] text-[#86868B] whitespace-nowrap">{product.strategyCategory || '-'}</td>
                        {DATA_COLUMNS.map((col) => (
                          <td key={col.key} className="px-5 py-3 text-right whitespace-nowrap">
                            {renderCell(product[col.key] as number, col.key !== 'sharpeRatio' && col.key !== 'annualizedVolatility')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
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
      className="px-5 py-3 text-right text-[13px] font-medium text-[#86868B] whitespace-nowrap cursor-pointer hover:text-[#0071E3] transition-colors select-none"
      onClick={() => onSort(field as any)}
    >
      <span className="flex items-center justify-end gap-1.5">
        {children}
        {currentSort === field && <ArrowUpDown className="w-3.5 h-3.5" />}
      </span>
    </th>
  );
}

function renderCell(value: any, isPct: boolean = true): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-[#A1A1A6]">-</span>;
  const numValue = Number(value);
  if (isNaN(numValue)) return <span className="text-[#A1A1A6]">-</span>;
  const isPositive = numValue >= 0;
  return (
    <span className={`text-[14px] font-semibold ${isPositive ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
      {formatValue(numValue, isPct)}
    </span>
  );
}

function renderMobileCell(product: FundProduct, field: keyof FundProduct): React.ReactNode {
  const value = product[field];
  const nonPctFields = ['sharpeRatio', 'excessSharpeRatio', 'karmaRatio'];
  const isPct = !nonPctFields.includes(field as string);
  if (typeof value === 'number') {
    return renderCell(value, isPct);
  }
  return <span className="text-[#A1A1A6]">-</span>;
}

// Box Plot Card for group summary
function BoxPlotCard({ title, stats, metricName, isPercentage = true }: { title: string; stats: any; metricName?: string; isPercentage?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ clientX: number; clientY: number; visible: boolean }>({ clientX: 0, clientY: 0, visible: false });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  if (!stats || stats.count === 0) {
    return (
      <div className="glass-card rounded-3xl p-6">
        <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">{title}</h3>
        <div className="text-center py-8 text-[#86868B] text-[15px]">暂无数据</div>
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
  const xMedian = mapX(stats.median);
  const xQ75 = mapX(stats.q75);
  const xMax = mapX(dataMax);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isTouchDevice) return;
    setTooltip({
      clientX: e.clientX,
      clientY: e.clientY,
      visible: true,
    });
  };

  const handleMouseLeave = () => {
    if (isTouchDevice) return;
    setTooltip({ clientX: 0, clientY: 0, visible: false });
  };

  // Touch events for mobile - show on touch, hide on release
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isTouchDevice) return;
    e.stopPropagation();
    const touch = e.touches[0];
    setTooltip({
      clientX: touch.clientX,
      clientY: touch.clientY,
      visible: true,
    });
  };

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isTouchDevice) return;
    e.stopPropagation();
    setTooltip({ clientX: 0, clientY: 0, visible: false });
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isTouchDevice) return;
    const touch = e.touches[0];
    setTooltip({
      clientX: touch.clientX,
      clientY: touch.clientY,
      visible: true,
    });
  };

  return (
    <div className="glass-card rounded-3xl p-6 glass-card-hover relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[17px] font-semibold text-[#1D1D1F] flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#0071E3]" />
          {title}
        </h3>
        <span className="text-[13px] text-[#86868B] font-medium px-2.5 py-0.5 rounded-full bg-[#00000006]">{stats.count} 只</span>
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          <defs>
            <linearGradient id="appleBoxGradient-${title}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0071E3" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#0071E3" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0071E3" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <line
            x1={padding}
            y1={yCenter}
            x2={chartWidth - padding}
            y2={yCenter}
            stroke="#00000010"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {xMin !== null && xQ25 !== null && (
            <>
              <line x1={xMin} y1={yCenter} x2={xQ25} y2={yCenter} stroke="#1D1D1F" strokeWidth="2" opacity="0.3" />
              <line x1={xMin} y1={yCenter - whiskerHeight / 2} x2={xMin} y2={yCenter + whiskerHeight / 2} stroke="#1D1D1F" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </>
          )}
          {xMax !== null && xQ75 !== null && (
            <>
              <line x1={xQ75} y1={yCenter} x2={xMax} y2={yCenter} stroke="#1D1D1F" strokeWidth="2" opacity="0.3" />
              <line x1={xMax} y1={yCenter - whiskerHeight / 2} x2={xMax} y2={yCenter + whiskerHeight / 2} stroke="#1D1D1F" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </>
          )}
          {xQ25 !== null && xQ75 !== null && (
            <rect
              x={xQ25}
              y={yCenter - boxHeight / 2}
              width={Math.max(xQ75 - xQ25, 2)}
              height={boxHeight}
              fill="url(#appleBoxGradient-${title})"
              rx="4"
              stroke="#0071E3"
              strokeWidth="1.5"
            />
          )}
          {xMedian !== null && (
            <circle cx={xMedian} cy={yCenter} r="4" fill="#FFFFFF" stroke="#0071E3" strokeWidth="2" />
          )}
        </svg>
        
        {/* Tooltip via portal */}
        {tooltip.visible && createPortal(
          <BoxPlotTooltip
            title={title}
            stats={stats}
            metricName={metricName}
            clientX={tooltip.clientX}
            clientY={tooltip.clientY}
            isPercentage={isPercentage}
          />,
          document.body
        )}
      </div>
      <div className="mt-4 flex items-center justify-end text-[12px] text-[#86868B]">
        <span className="text-[13px] text-[#86868B] font-medium px-2.5 py-0.5 rounded-full bg-[#00000006]">{stats.count} 只</span>
      </div>
    </div>
  );
}

function BoxPlotTooltip({
  title,
  stats,
  metricName,
  clientX,
  clientY,
  isPercentage = true,
}: {
  title: string;
  stats: any;
  metricName?: string;
  clientX: number;
  clientY: number;
  isPercentage?: boolean;
}) {
  const tooltipWidth = 160;
  const tooltipHeight = 145;

  let left = clientX + 14;
  let top = clientY - tooltipHeight / 2;

  if (left + tooltipWidth > window.innerWidth - 8) {
    left = clientX - tooltipWidth - 14;
  }
  if (top + tooltipHeight > window.innerHeight - 8) {
    top = window.innerHeight - tooltipHeight - 8;
  }
  if (top < 8) {
    top = 8;
  }
  if (left < 8) {
    left = 8;
  }

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top }}
    >
      <div className="glass-card rounded-2xl p-4 shadow-apple-lg w-[160px] backdrop-blur-xl bg-[#FFFFFF]/90">
        <div className="text-[13px] font-semibold text-[#1D1D1F] mb-1 pb-2 border-b border-[#0000000D]">
          {metricName || title}
        </div>
        <div className="space-y-2">
          <TooltipRow label="最大值" value={stats.max} isPercentage={isPercentage} />
          <TooltipRow label="25分位" value={stats.q75} isPercentage={isPercentage} />
          <TooltipRow label="中位数" value={stats.median} isMean isPercentage={isPercentage} />
          <TooltipRow label="75分位" value={stats.q25} isPercentage={isPercentage} />
          <TooltipRow label="最小值" value={stats.min} isPercentage={isPercentage} />
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  isMean,
  isPercentage = true,
}: {
  label: string;
  value: number | null;
  isMean?: boolean;
  isPercentage?: boolean;
}) {
  const colorClass =
    value === null
      ? 'text-[#A1A1A6]'
      : value >= 0
      ? 'text-[#DC2626]'
      : 'text-[#16A34A]';

  return (
    <div className="flex justify-between items-center text-[13px]">
      <span className="text-[#86868B]">{label}</span>
      <span className={`font-semibold ${colorClass} ${isMean ? 'font-bold' : ''}`}>
        {formatValue(value, isPercentage)}
      </span>
    </div>
  );
}
