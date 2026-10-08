'use client';

import React from 'react';
import BoxPlot from '@/components/BoxPlot';
import type { StrategyOverview } from '@/lib/types';

interface SecondaryStrategy {
  name: string;
  productCount: number;
  products: Array<{
    productCode: string;
    productName: string;
  }>;
  stats: {
    weeklyReturn?: {
      count: number;
      min: number | null;
      q25: number | null;
      median: number | null;
      q75: number | null;
      max: number | null;
    };
    monthlyReturn?: {
      count: number;
      min: number | null;
      q25: number | null;
      median: number | null;
      q75: number | null;
      max: number | null;
    };
    ytdReturn?: {
      count: number;
      min: number | null;
      q25: number | null;
      median: number | null;
      q75: number | null;
      max: number | null;
    };
  };
}

interface PrimaryStrategy {
  name: string;
  productCount: number;
  secondaryStrategies: SecondaryStrategy[];
}

interface DynamicStrategyCardProps {
  primaryStrategy: PrimaryStrategy;
  index: number;
}

/**
 * 动态策略卡片组件
 * 展示一级策略及其下属二级策略的箱型图
 */
export default function DynamicStrategyCard({ primaryStrategy, index }: DynamicStrategyCardProps) {
  return (
    <div 
      className="glass-card rounded-3xl p-6 glass-card-hover"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* 一级策略标题 */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#0000000D]">
        <h3 className="text-[19px] font-semibold text-[#1D1D1F] flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#0071E3]" />
          {primaryStrategy.name}
        </h3>
        <span className="text-[13px] text-[#86868B] font-medium px-3 py-1 rounded-full bg-[#00000006]">
          {primaryStrategy.productCount} 只产品
        </span>
      </div>

      {/* 二级策略箱型图 */}
      {primaryStrategy.secondaryStrategies.length > 0 ? (
        <div className="space-y-6">
          {primaryStrategy.secondaryStrategies.map((secondary, secIndex) => (
            <div key={secondary.name}>
              {/* 二级策略标题 */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[15px] font-medium text-[#1D1D1F] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#34C759]" />
                  {secondary.name}
                </h4>
                <span className="text-[12px] text-[#86868B]">
                  {secondary.productCount} 只
                </span>
              </div>

              {/* 箱型图指标 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {secondary.stats.weeklyReturn && secondary.stats.weeklyReturn.count > 0 && (
                  <BoxPlot
                    strategy={{
                      strategyType: secondary.name,
                      strategyName: `${primaryStrategy.name} - ${secondary.name}`,
                      count: secondary.stats.weeklyReturn!.count,
                      min: secondary.stats.weeklyReturn!.min,
                      q25: secondary.stats.weeklyReturn!.q25,
                      median: secondary.stats.weeklyReturn!.median,
                      q75: secondary.stats.weeklyReturn!.q75,
                      max: secondary.stats.weeklyReturn!.max,
                    }}
                    onClick={() => {}}
                    metricName="近一周收益"
                    isPercentage={true}
                  />
                )}
                {secondary.stats.monthlyReturn && secondary.stats.monthlyReturn.count > 0 && (
                  <BoxPlot
                    strategy={{
                      strategyType: secondary.name,
                      strategyName: `${primaryStrategy.name} - ${secondary.name}`,
                      count: secondary.stats.monthlyReturn!.count,
                      min: secondary.stats.monthlyReturn!.min,
                      q25: secondary.stats.monthlyReturn!.q25,
                      median: secondary.stats.monthlyReturn!.median,
                      q75: secondary.stats.monthlyReturn!.q75,
                      max: secondary.stats.monthlyReturn!.max,
                    }}
                    onClick={() => {}}
                    metricName="近一月收益"
                    isPercentage={true}
                  />
                )}
                {secondary.stats.ytdReturn && secondary.stats.ytdReturn.count > 0 && (
                  <BoxPlot
                    strategy={{
                      strategyType: secondary.name,
                      strategyName: `${primaryStrategy.name} - ${secondary.name}`,
                      count: secondary.stats.ytdReturn!.count,
                      min: secondary.stats.ytdReturn!.min,
                      q25: secondary.stats.ytdReturn!.q25,
                      median: secondary.stats.ytdReturn!.median,
                      q75: secondary.stats.ytdReturn!.q75,
                      max: secondary.stats.ytdReturn!.max,
                    }}
                    onClick={() => {}}
                    metricName="今年以来收益"
                    isPercentage={true}
                  />
                )}
              </div>

              {/* 分隔线（最后一个除外） */}
              {secIndex < primaryStrategy.secondaryStrategies.length - 1 && (
                <div className="mt-6 pt-6 border-b border-[#0000000D]" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[#86868B] text-[15px]">
          暂无二级策略数据
        </div>
      )}
    </div>
  );
}
