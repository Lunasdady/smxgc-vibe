'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { StrategyOverview, STRATEGY_GROUPS, STRATEGY_NAME_MAP } from '@/lib/types';
import DateSelector from '@/components/DateSelector';
import Sidebar from '@/components/Sidebar';
import BoxPlot from '@/components/BoxPlot';
import WeeklyDetailTable from '@/components/WeeklyDetailTable';
import { Menu, TrendingUp, BarChart3 } from 'lucide-react';

export default function HomePage() {
  const { dataDate, initialize } = useAppStore();
  const [strategies, setStrategies] = useState<StrategyOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (dataDate) {
      fetchStrategyOverview();
    }
  }, [dataDate]);

  const fetchStrategyOverview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/strategies/overview?dataDate=${dataDate}`);
      const data = await response.json();
      setStrategies(data.strategies || []);
    } catch (error) {
      console.error('Failed to fetch strategy overview:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build a map for quick lookup
  const strategyMap = new Map(strategies.map((s) => [s.strategyType, s]));

  // Calculate overall stats
  const totalProducts = strategies.reduce((sum, s) => sum + s.count, 0);
  const activeStrategies = strategies.filter((s) => s.count > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-dark-bg to-slate-900/30 overflow-x-hidden">
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
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-dark-textDim">私募星工厂 · 全量业绩跟踪</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-dark-textMuted">总产品</span>
                <span className="text-dark-text font-mono font-semibold">{totalProducts}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border">
                <span className="text-dark-textMuted">活跃策略</span>
                <span className="text-dark-text font-mono font-semibold">{activeStrategies}</span>
              </div>
            </div>
            <div className="flex-1 sm:flex-none sm:w-48">
              <DateSelector />
            </div>
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
                {/* Strategy Tree Layout */}
                <div className="space-y-8">
                  {STRATEGY_GROUPS.map((group) => {
                    const groupStrategies = group.strategies
                      .map((type) => strategyMap.get(type))
                      .filter((s): s is StrategyOverview => !!s);

                    if (groupStrategies.length === 0) return null;

                    const hasSubmenu = group.hasSubmenu && groupStrategies.length > 1;

                    return (
                      <section key={group.name} className="relative animate-fade-in">
                        {/* Group Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-px flex-1 bg-gradient-to-r from-dark-border via-cyan-400/20 to-transparent" />
                          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-dark-card border border-dark-border shadow-lg animate-pulse-glow">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <h2 className="text-sm font-semibold text-dark-text tracking-wide">
                              {group.name}
                            </h2>
                            <span className="text-xs text-dark-textDim font-mono">
                              {groupStrategies.reduce((s, g) => s + g.count, 0)} 只
                            </span>
                          </div>
                          <div className="h-px flex-1 bg-gradient-to-l from-dark-border via-cyan-400/20 to-transparent" />
                        </div>

                        {/* Strategy Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {groupStrategies.map((strategy, index) => (
                            <div
                              key={strategy.strategyType}
                              className="animate-slide-in"
                              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                            >
                              <BoxPlot
                                strategy={strategy}
                                groupName={hasSubmenu ? group.name : undefined}
                                onClick={() => setSelectedStrategy(strategy.strategyType)}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>

                {/* Weekly Detail Table */}
                {selectedStrategy && (
                  <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <WeeklyDetailTable
                      strategyType={selectedStrategy}
                      dataDate={dataDate!}
                      onClose={() => setSelectedStrategy(null)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
