'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STRATEGY_GROUPS, STRATEGY_NAME_MAP, getFuturesStrategies, FUTURES_CUTOFF_DATE } from '@/lib/types';
import { ChevronDown, ChevronRight, X, LayoutDashboard } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { dataDate } = useAppStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '指增策略': true,
    '期货策略': true,
  });

  // 动态获取期货策略列表
  const futuresStrategies = getFuturesStrategies(dataDate);
  
  // 构建动态策略分组
  const dynamicStrategyGroups = STRATEGY_GROUPS.map(group => {
    if (group.isDynamic) {
      return { ...group, strategies: futuresStrategies };
    }
    return group;
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-dark-card border-r border-dark-border transform transition-transform duration-300 z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile close */}
          <div className="flex items-center justify-between p-4 border-b border-dark-border md:hidden">
            <h2 className="text-sm font-semibold text-dark-text">菜单</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-dark-cardHover rounded-lg transition-colors text-dark-textMuted">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Logo area - desktop */}
          <div className="hidden md:flex items-center gap-2 px-4 py-4 border-b border-dark-border">
            <LayoutDashboard className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-bold text-dark-text tracking-wide">私募星工厂</span>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto py-3">
            <Link
              href="/"
              className={`flex items-center gap-2 mx-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                pathname === '/'
                  ? 'bg-cyan-400/10 text-cyan-400 font-semibold border border-cyan-400/20'
                  : 'text-dark-textMuted hover:text-dark-text hover:bg-dark-cardHover'
              }`}
              onClick={handleNavClick}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${pathname === '/' ? 'bg-cyan-400' : 'bg-dark-textDim'}`} />
              首页概览
            </Link>

            <div className="mt-3 px-4 pb-1">
              <span className="text-[10px] font-semibold text-dark-textDim uppercase tracking-wider">策略分类</span>
            </div>

            {dynamicStrategyGroups.map((group) => {
              const hasSubmenu = group.hasSubmenu;
              const isExpanded = expandedGroups[group.name];

              return (
                <div key={group.name} className="px-2">
                  {hasSubmenu ? (
                    <>
                      <button
                        onClick={() => toggleGroup(group.name)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-dark-cardHover transition-all duration-200 text-sm text-dark-textMuted hover:text-dark-text"
                      >
                        <span className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-cyan-400/40" />
                          {group.name}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-dark-textDim" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-dark-textDim" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-dark-border pl-2">
                          {group.strategies.map((strategyType) => {
                            const strategyName = STRATEGY_NAME_MAP[strategyType];
                            const href = `/strategy/${strategyType}`;
                            const isActive = pathname === href;
                            return (
                              <Link
                                key={strategyType}
                                href={href}
                                className={`block px-3 py-1.5 rounded-md transition-all duration-200 text-xs ${
                                  isActive
                                    ? 'bg-cyan-400/10 text-cyan-400 font-medium'
                                    : 'text-dark-textDim hover:text-dark-text hover:bg-dark-cardHover'
                                }`}
                                onClick={handleNavClick}
                              >
                                {strategyName}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={`/strategy/${group.strategies[0]}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                        pathname === `/strategy/${group.strategies[0]}`
                          ? 'bg-cyan-400/10 text-cyan-400 font-medium border border-cyan-400/20'
                          : 'text-dark-textMuted hover:text-dark-text hover:bg-dark-cardHover'
                      }`}
                      onClick={handleNavClick}
                    >
                      <div className={`w-1 h-1 rounded-full ${pathname === `/strategy/${group.strategies[0]}` ? 'bg-cyan-400' : 'bg-dark-textDim'}`} />
                      {STRATEGY_NAME_MAP[group.strategies[0]]}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-dark-border">
            <p className="text-[10px] text-dark-textDim text-center">私募星工厂 · 数据展板</p>
          </div>
        </div>
      </aside>
    </>
  );
}
