'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { StrategyOverview, STRATEGY_GROUPS, STRATEGY_NAME_MAP, getMetricFields, getFuturesStrategies, getNonIndexEnhancedMetricLabel } from '@/lib/types';
import DateSelector from '@/components/DateSelector';
import BoxPlot from '@/components/BoxPlot';
import WeeklyDetailTable from '@/components/WeeklyDetailTable';
import Navbar from '@/components/Navbar';
import MetricSelector from '@/components/MetricSelector';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useCountUp } from '@/hooks/useCountUp';
import { useAccessLog } from '@/hooks/useAccessLog';
import { TrendingUp, BarChart3, ArrowDown, ChevronRight } from 'lucide-react';

export default function HomePage() {
  useAccessLog('/');
  const router = useRouter();
  const { dataDate, metric, initialize, initializing, heroTitle, heroSubtitle } = useAppStore();
  const [strategies, setStrategies] = useState<StrategyOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  // 动态获取期货策略列表（根据日期切换旧期货/新CTA）
  const futuresStrategies = getFuturesStrategies(dataDate);
  
  // 构建动态策略分组（替换期货策略组的策略列表）
  const dynamicStrategyGroups = STRATEGY_GROUPS.map(group => {
    if (group.isDynamic) {
      return { ...group, strategies: futuresStrategies };
    }
    return group;
  });

  // 使用动态指标字段（首页不指定策略类型，使用指增新字段）
  const metricFields = getMetricFields(dataDate, null);
  const currentMetric = metricFields.find(m => m.key === metric) || metricFields[0];

  // 只初始化一次
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      initialize();
    }
  }, [initialize]);

  useEffect(() => {
    // 等待初始化完成后再加载数据
    if (!dataDate || !metric || initializing) return;
    
    const controller = new AbortController();
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/strategies/overview?dataDate=${dataDate}&metric=${metric}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        setStrategies(data.strategies || []);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch strategy overview:', error);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    return () => controller.abort();
  }, [dataDate, metric, initializing]);

  // Build a map for quick lookup
  const strategyMap = new Map(strategies.map((s) => [s.strategyType, s]));

  // Calculate overall stats
  const totalProducts = strategies.reduce((sum, s) => sum + s.count, 0);
  const activeStrategies = strategies.filter((s) => s.count > 0).length;
  const avgReturn = strategies.length > 0
    ? strategies.reduce((sum, s) => sum + (s.mean || 0), 0) / strategies.length
    : 0;

  // Scroll reveal refs
  const heroReveal = useScrollReveal();
  const statsReveal = useScrollReveal();
  const gridReveal = useScrollReveal();

  // 数据加载完成后强制显示策略网格
  useEffect(() => {
    if (!loading && strategies.length > 0) {
      // 延迟一帧确保 DOM 完全渲染
      requestAnimationFrame(() => {
        gridReveal.forceReveal();
      });
    }
  }, [loading, strategies.length]);

  // Count-up animation for hero stats
  const { current: totalDisplay } = useCountUp(totalProducts, 1800, 0, true, statsReveal.revealed);
  const { current: avgDisplay } = useCountUp(avgReturn, 1800, 2, true, statsReveal.revealed);
  const { current: strategiesDisplay } = useCountUp(activeStrategies, 1200, 0, true, statsReveal.revealed);

  return (
    <div className="min-h-screen bg-[#F5F5F7] overflow-x-hidden">
      <Navbar />

      {/* Spacer for fixed nav */}
      <div className="h-14" />

      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div ref={heroReveal.ref} className={`scroll-reveal ${heroReveal.revealed ? 'revealed' : ''}`}>
          <div className="text-center mb-16">
            <h1 className="large-title text-[#1D1D1F] mb-4" dangerouslySetInnerHTML={{ __html: heroTitle }} />
            <p className="text-[19px] text-[#86868B] max-w-2xl mx-auto leading-relaxed">
              {heroSubtitle}
            </p>
          </div>

          {/* Bento Grid - Core Metrics */}
          <div ref={statsReveal.ref} className={`scroll-reveal ${statsReveal.revealed ? 'revealed' : ''}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
              <MetricCard
                label="跟踪策略"
                value={`${strategiesDisplay} 个`}
                icon={<BarChart3 className="w-5 h-5" />}
                delay={100}
              />
              <MetricCard
                label="产品总数"
                value={`${totalDisplay} 只`}
                icon={<TrendingUp className="w-5 h-5" />}
                delay={200}
              />
              <MetricCard
                label="中位收益"
                value={`${avgDisplay >= 0 ? '+' : ''}${avgDisplay}%`}
                icon={<ArrowDown className="w-5 h-5" />}
                accent={avgReturn >= 0 ? 'positive' : 'negative'}
                delay={300}
              />
              <MetricCard
                label="数据日期"
                value={dataDate || '-'}
                icon={<ArrowDown className="w-5 h-5" />}
                isDate
                delay={400}
              />
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10 pb-6 border-b border-[#0000000D]">
          <div className="flex items-center gap-4">
            <h2 className="section-title text-[#1D1D1F]">策略业绩概览</h2>
          </div>
          <div className="flex items-center gap-3">
            <MetricSelector />
            <DateSelector />
          </div>
        </div>

        {/* 指标说明提示 */}
        <div className="flex items-start gap-2 mb-6 px-3 py-2.5 bg-[#F5F5F7]/50 rounded-xl border border-[#00000008]">
          <svg className="w-4 h-4 text-[#86868B] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-[12px] text-[#86868B] leading-relaxed">
            实际展示指标以箱型图浮窗标签为准，指增策略显示超额收益，其他策略显示绝对收益
          </p>
        </div>

        {/* Strategy Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
              <p className="text-[15px] text-[#86868B]">加载数据中...</p>
            </div>
          </div>
        ) : (
          <div ref={gridReveal.ref} className={`scroll-reveal ${gridReveal.revealed ? 'revealed' : ''}`}>
            <div className="space-y-16">
              {dynamicStrategyGroups.map((group) => {
                const groupStrategies = group.strategies
                  .map((type) => strategyMap.get(type))
                  .filter((s): s is StrategyOverview => !!s);

                if (groupStrategies.length === 0) return null;

                const hasSubmenu = group.hasSubmenu && groupStrategies.length > 1;
                const totalInGroup = groupStrategies.reduce((s, g) => s + g.count, 0);

                return (
                  <section key={group.name}>
                    {/* Group Header */}
                    <div className="flex items-center gap-4 mb-6">
                      <h3 className="text-[24px] font-semibold text-[#1D1D1F] tracking-tight">
                        {group.name}
                      </h3>
                      <span className="px-3 py-1 rounded-full bg-[#00000006] text-[13px] text-[#86868B] font-medium">
                        {totalInGroup} 只产品
                      </span>
                    </div>

                    {/* Bento Grid for strategy cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {groupStrategies.map((strategy) => {
                        // 根据策略类型获取正确的指标字段
                        const strategyMetricFields = getMetricFields(dataDate, strategy.strategyType);
                        const strategyCurrentMetric = strategyMetricFields.find(m => m.key === metric) || strategyMetricFields[0];
                        
                        // 非指增策略需要映射指标名称
                        const indexEnhancedTypes = ['index-enhanced-300', 'index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
                        const isIndexEnhanced = indexEnhancedTypes.includes(strategy.strategyType);
                        const displayMetricLabel = isIndexEnhanced ? strategyCurrentMetric.label : getNonIndexEnhancedMetricLabel(metric);
                        
                        return (
                          <div
                            key={strategy.strategyType}
                            className="group glass-card rounded-3xl p-5 glass-card-hover cursor-pointer"
                            onClick={() => setSelectedStrategy(strategy.strategyType)}
                          >
                            <BoxPlot
                              strategy={strategy}
                              groupName={hasSubmenu ? group.name : undefined}
                              metric={metric}
                              metricName={displayMetricLabel}
                              isPercentage={strategyCurrentMetric.isPercentage}
                              onClick={() => setSelectedStrategy(strategy.strategyType)}
                            />
                            <div 
                              className="mt-3 flex items-center justify-between text-[12px] text-[#86868B] group-hover:text-[#0071E3] transition-colors cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                // 检查用户登录状态
                                const hasToken = document.cookie.includes('user-token=');
                                if (!hasToken) {
                                  if (confirm('登录后可查看产品数据详情，是否前往登录？')) {
                                    router.push(`/login?redirect=/strategy/${strategy.strategyType}`);
                                  }
                                  return;
                                }
                                router.push(`/strategy/${strategy.strategyType}`);
                              }}
                            >
                              <span>查看明细</span>
                              <ChevronRight className="w-3.5 h-3.5 transform transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly Detail Table */}
        {selectedStrategy && (
          <div className="mt-12 scroll-reveal revealed">
            <WeeklyDetailTable
              strategyType={selectedStrategy}
              dataDate={dataDate!}
              onClose={() => setSelectedStrategy(null)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#0000000D] mt-20 py-8">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-[#86868B]">
            <p>© 2026 私募星工厂 · 数据仅供参考，不构成投资建议</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-[#1D1D1F] transition-colors">免责声明</a>
              <a href="#" className="hover:text-[#1D1D1F] transition-colors">隐私政策</a>
              <a href="#" className="hover:text-[#1D1D1F] transition-colors">联系我们</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent,
  isDate,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: 'positive' | 'negative';
  isDate?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="glass-card rounded-3xl p-5 glass-card-hover"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[#86868B]">{icon}</div>
        <span className="text-[13px] text-[#86868B] font-medium">{label}</span>
      </div>
      <div
        className={`text-[28px] font-semibold tracking-tight ${
          isDate
            ? 'text-[#1D1D1F] font-mono text-[20px]'
            : accent === 'positive'
              ? 'text-[#DC2626]'
              : accent === 'negative'
                ? 'text-[#16A34A]'
                : 'text-[#1D1D1F]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
