import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateFiveNumberStats } from '@/lib/stats';
import { STRATEGY_NAME_MAP, getFuturesStrategies } from '@/lib/types';
import dayjs from 'dayjs';

// 强制动态渲染，不使用静态缓存
export const dynamic = 'force-dynamic';

// 新字段到旧字段的映射（非指增策略在日期>=2026-07-08时回退使用）
const NEW_TO_OLD_METRIC_MAP: Record<string, string> = {
  excessReturn1w: 'weeklyReturn',
  excessReturn3m: 'monthlyReturn',
  excessReturnYtd: 'ytdReturn',
  excessAnnualizedReturn: 'annualizedReturnSinceInception',
  excessYtdMaxDrawdown: 'ytdMaxDrawdown',
  excessInceptionMaxDrawdown: 'inceptionMaxDrawdown',
  excessAnnualizedVolatility: 'annualizedVolatility',
  excessSharpeRatio: 'sharpeRatio',
};

function getActualMetric(metric: string, strategyType: string, dataDate: string): string {
  const date = new Date(dataDate);
  const cutoffDate = new Date('2026-07-08');

  const indexEnhancedTypes = [
    'index-enhanced-300',
    'index-enhanced-500',
    'index-enhanced-1000',
    'index-enhanced-2000',
    'index-enhanced-alternative',
  ];
  const isIndexEnhanced = indexEnhancedTypes.includes(strategyType);

  // 日期 >= 2026-07-08：指增策略必须使用新字段
  if (date >= cutoffDate && isIndexEnhanced) {
    // 如果传入的是旧字段，映射为新字段
    const oldToNewMap: Record<string, string> = {
      weeklyReturn: 'excessReturn1w',
      monthlyReturn: 'excessReturn3m',
      ytdReturn: 'excessReturnYtd',
      annualizedReturnSinceInception: 'excessAnnualizedReturn',
      ytdMaxDrawdown: 'excessYtdMaxDrawdown',
      inceptionMaxDrawdown: 'excessInceptionMaxDrawdown',
      annualizedVolatility: 'excessAnnualizedVolatility',
      sharpeRatio: 'excessSharpeRatio',
    };
    return oldToNewMap[metric] || metric;
  }

  // 日期 < 2026-07-08：保持原metric
  if (date < cutoffDate) return metric;

  // 非指增策略：将新字段映射回旧字段
  return NEW_TO_OLD_METRIC_MAP[metric] || metric;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let dataDate = searchParams.get('dataDate');
    const metric = searchParams.get('metric') || 'weeklyReturn';

    // 如果没有指定日期，使用最新日期
    if (!dataDate) {
      const latest = await prisma.fundProduct.findFirst({
        orderBy: { dataDate: 'desc' },
        select: { dataDate: true },
      });
      dataDate = latest ? dayjs(latest.dataDate).format('YYYY-MM-DD') : null;
    }

    if (!dataDate) {
      return NextResponse.json({ strategies: [] });
    }

    // 获取动态策略类型列表（根据日期切换期货/CTA）
    const futuresStrategies = getFuturesStrategies(dataDate);
    const strategyTypes = Object.keys(STRATEGY_NAME_MAP).filter(type => {
      // 排除旧期货策略（如果使用新CTA）或排除新CTA策略（如果使用旧期货）
      const isOldFutures = ['subjective-futures', 'quantitative-futures'].includes(type);
      const isNewCta = ['subjective-cta', 'quantitative-cta', 'composite-cta'].includes(type);
      
      if (futuresStrategies.includes(type)) return true;
      if (isOldFutures && !futuresStrategies.includes('subjective-futures')) return false;
      if (isNewCta && !futuresStrategies.includes('subjective-cta')) return false;
      return true;
    });
    
    const strategies = [];

    for (const strategyType of strategyTypes) {
      // 根据策略类型和日期确定实际查询的字段
      const actualMetric = getActualMetric(metric, strategyType, dataDate);

      // 查询该策略类型的所有产品
      const products = await prisma.fundProduct.findMany({
        where: {
          dataDate: new Date(dataDate),
          strategyType,
        },
        select: {
          [actualMetric]: true,
        } as any,
      });

      // 计算五数统计
      const values = products
        .map((p: any) => p[actualMetric])
        .filter((v: number | null): v is number => v !== null && !isNaN(v));

      const stats = calculateFiveNumberStats(values);

      strategies.push({
        strategyType,
        strategyName: STRATEGY_NAME_MAP[strategyType] || strategyType,
        ...stats,
      });
    }

    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('Error fetching strategy overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategy overview' },
      { status: 500 }
    );
  }
}