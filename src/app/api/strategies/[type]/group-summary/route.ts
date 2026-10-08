import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateFiveNumberStats } from '@/lib/stats';
import { FUTURES_CUTOFF_DATE, OLD_FUTURES_STRATEGIES, NEW_CTA_STRATEGIES } from '@/lib/types';
import dayjs from 'dayjs';
import { verifyRequestAuth, hasPermission } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { type: string } }
) {
  try {
    // 校验策略访问权限（查询数据库最新权限）
    const auth = await verifyRequestAuth(request);
    if (!hasPermission(auth, 'strategy-detail')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let dataDate = searchParams.get('dataDate');
    const metric = searchParams.get('metric') || 'weeklyReturn';
    const strategyType = params.type;

    // 如果没有指定日期，使用最新日期
    if (!dataDate) {
      const latest = await prisma.fundProduct.findFirst({
        orderBy: { dataDate: 'desc' },
        select: { dataDate: true },
      });
      dataDate = latest ? dayjs(latest.dataDate).format('YYYY-MM-DD') : null;
    }

    if (!dataDate) {
      return NextResponse.json({
        largeScale: { count: 0, min: null, q25: null, median: null, q75: null, max: null },
        smallScale: { count: 0, min: null, q25: null, median: null, q75: null, max: null },
      });
    }

    // 根据日期动态映射策略类型（CTA <-> 期货）
    const date = new Date(dataDate);
    const cutoffDate = new Date(FUTURES_CUTOFF_DATE);
    let actualStrategyType = strategyType;
    
    // 如果访问的是新CTA策略但日期在截止日前，映射到旧期货策略
    if (date < cutoffDate && NEW_CTA_STRATEGIES.includes(strategyType)) {
      if (strategyType === 'subjective-cta') actualStrategyType = 'subjective-futures';
      else if (strategyType === 'quantitative-cta') actualStrategyType = 'quantitative-futures';
      else if (strategyType === 'composite-cta') {
        // 复合CTA在旧数据中不存在，返回空
        return NextResponse.json({
          largeScale: { count: 0, min: null, q25: null, median: null, q75: null, max: null },
          smallScale: { count: 0, min: null, q25: null, median: null, q75: null, max: null },
        });
      }
    }
    // 如果访问的是旧期货策略但日期在截止日后，映射到新CTA策略
    else if (date >= cutoffDate && OLD_FUTURES_STRATEGIES.includes(strategyType)) {
      if (strategyType === 'subjective-futures') actualStrategyType = 'subjective-cta';
      else if (strategyType === 'quantitative-futures') actualStrategyType = 'quantitative-cta';
    }

    // 将日期转为 Unix 时间戳（毫秒），因为数据库中 dataDate 存的是整数
    const targetTimestamp = new Date(dataDate + 'T00:00:00.000Z').getTime();

    // 指增策略超额收益字段回退映射
    const indexEnhancedTypes = ['index-enhanced-300', 'index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
    const isIndexEnhanced = indexEnhancedTypes.includes(strategyType);
    const needsFallback = isIndexEnhanced && date >= new Date('2026-07-08') && metric.startsWith('excess');
    const oldMetric = needsFallback ? {
      excessReturn1w: 'weeklyReturn',
      excessReturn3m: 'monthlyReturn',
      excessReturnYtd: 'ytdReturn',
      excessAnnualizedReturn: 'annualizedReturnSinceInception',
      excessYtdMaxDrawdown: 'ytdMaxDrawdown',
      excessInceptionMaxDrawdown: 'inceptionMaxDrawdown',
      excessAnnualizedVolatility: 'annualizedVolatility',
      excessSharpeRatio: 'sharpeRatio',
    }[metric] : null;

    // 查询 100 亿以上产品（使用 COALESCE 回退）
    const largeScaleProducts = await prisma.$queryRawUnsafe<any[]>(
      oldMetric
        ? `SELECT COALESCE("${metric}", "${oldMetric}") as value FROM FundProduct WHERE dataDate = ${targetTimestamp} AND strategyType = '${actualStrategyType}' AND isLargeScale = 1`
        : `SELECT "${metric}" as value FROM FundProduct WHERE dataDate = ${targetTimestamp} AND strategyType = '${actualStrategyType}' AND isLargeScale = 1`
    );

    // 查询 100 亿以下产品（使用 COALESCE 回退）
    const smallScaleProducts = await prisma.$queryRawUnsafe<any[]>(
      oldMetric
        ? `SELECT COALESCE("${metric}", "${oldMetric}") as value FROM FundProduct WHERE dataDate = ${targetTimestamp} AND strategyType = '${actualStrategyType}' AND isLargeScale = 0`
        : `SELECT "${metric}" as value FROM FundProduct WHERE dataDate = ${targetTimestamp} AND strategyType = '${actualStrategyType}' AND isLargeScale = 0`
    );

    const largeValues = largeScaleProducts
      .map((p: any) => p.value)
      .filter((v: number | null): v is number => v !== null && !isNaN(v));

    const smallValues = smallScaleProducts
      .map((p: any) => p.value)
      .filter((v: number | null): v is number => v !== null && !isNaN(v));

    return NextResponse.json({
      largeScale: calculateFiveNumberStats(largeValues),
      smallScale: calculateFiveNumberStats(smallValues),
    });
  } catch (error) {
    console.error('Error fetching group summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group summary' },
      { status: 500 }
    );
  }
}
