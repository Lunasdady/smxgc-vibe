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

    // 将日期字符串转为Unix时间戳（毫秒）用于查询
    // 使用 UTC 时间，与数据库中存储的时间戳保持一致
    const targetTimestamp = Date.UTC(
      parseInt(dataDate.split('-')[0]),
      parseInt(dataDate.split('-')[1]) - 1,
      parseInt(dataDate.split('-')[2])
    );

    // 从 FundProduct 表中查询当前日期实际存在的所有 strategyType
    const existingStrategyTypes = await prisma.$queryRawUnsafe<{ strategyType: string }[]>(
      `SELECT DISTINCT strategyType FROM FundProduct WHERE dataDate = ${targetTimestamp}`
    );
    const existingTypes = new Set(existingStrategyTypes.map(s => s.strategyType));
    
    // 合并预定义策略和实际存在的自定义策略
    const allStrategyTypes = new Set(Object.keys(STRATEGY_NAME_MAP));
    existingTypes.forEach(t => allStrategyTypes.add(t));

    // 获取动态策略类型列表（根据日期切换期货/CTA）
    const futuresStrategies = getFuturesStrategies(dataDate);
    const strategyTypes = Array.from(allStrategyTypes).filter(type => {
      // 排除旧期货策略（如果使用新CTA）或排除新CTA策略（如果使用旧期货）
      const isOldFutures = ['subjective-futures', 'quantitative-futures'].includes(type);
      const isNewCta = ['subjective-cta', 'quantitative-cta', 'composite-cta'].includes(type);
      
      if (futuresStrategies.includes(type)) return true;
      if (isOldFutures && !futuresStrategies.includes('subjective-futures')) return false;
      if (isNewCta && !futuresStrategies.includes('subjective-cta')) return false;
      return true;
    });
    
    // 查询策略字典，建立二级策略到一级策略的映射
    const strategyDict = await prisma.strategyDictionary.findMany({
      where: { level: 2 },
      select: { parentStrategy: true, strategyName: true },
    });
    const secondaryToPrimary = new Map<string, string>();
    for (const dict of strategyDict) {
      if (dict.parentStrategy && dict.strategyName) {
        secondaryToPrimary.set(dict.strategyName, dict.parentStrategy);
      }
    }

    // 查询一级策略的排序信息
    const primaryDict = await prisma.strategyDictionary.findMany({
      where: { level: 1 },
      select: { strategyName: true, sortOrder: true },
    });
    const primarySortOrder = new Map<string, number>();
    for (const dict of primaryDict) {
      if (dict.strategyName && dict.sortOrder !== null) {
        primarySortOrder.set(dict.strategyName, dict.sortOrder);
      }
    }

    const strategies = [];

    for (const strategyType of strategyTypes) {
      // 根据策略类型和日期确定实际查询的字段
      const actualMetric = getActualMetric(metric, strategyType, dataDate);
      
      // 获取策略中文名称
      let strategyName = STRATEGY_NAME_MAP[strategyType];
      let groupName: string | undefined;
      
      if (!strategyName && strategyType.startsWith('custom-')) {
        // 自定义策略：从 strategyType 中提取二级策略名称
        const secondaryName = strategyType.replace('custom-', '');
        strategyName = secondaryName;
        // 查找对应的一级策略作为分组名
        groupName = secondaryToPrimary.get(secondaryName);
      }

      // 为所有策略（包括预定义策略）查找一级策略分组名
      if (!groupName) {
        // 通过样本产品查询对应的一级策略（使用raw SQL避免类型问题）
        const sampleProducts = await prisma.$queryRawUnsafe<{ productName: string }[]>(
          `SELECT productName FROM FundProduct WHERE strategyType = ? AND dataDate = ? LIMIT 1`,
          strategyType,
          targetTimestamp
        );
        if (sampleProducts.length > 0) {
          const mapping = await prisma.strategyMapping.findFirst({
            where: { productName: sampleProducts[0].productName },
            select: { primaryStrategy: true },
          });
          if (mapping?.primaryStrategy) {
            groupName = mapping.primaryStrategy;
          }
        }
      }

      // 使用原始SQL查询（因为dataDate存储为Unix时间戳整数）
      let products: any[];
      
      // 对于指增策略且日期 >= 2026-07-08，如果新字段为空则回退到旧字段
      const date = new Date(dataDate);
      const cutoffDate = new Date('2026-07-08');
      const indexEnhancedTypes = [
        'index-enhanced-300', 'index-enhanced-500', 'index-enhanced-1000',
        'index-enhanced-2000', 'index-enhanced-alternative'
      ];
      const isIndexEnhanced = indexEnhancedTypes.includes(strategyType);
      const needsFallback = date >= cutoffDate && isIndexEnhanced && actualMetric.startsWith('excess');
      
      if (needsFallback) {
        // 同时查询新字段和对应的旧字段
        const oldMetric = NEW_TO_OLD_METRIC_MAP[actualMetric] || actualMetric;
        products = await prisma.$queryRawUnsafe(
          `SELECT "${actualMetric}" as newValue, "${oldMetric}" as oldValue 
           FROM FundProduct WHERE dataDate = ? AND strategyType = ?`,
          targetTimestamp,
          strategyType
        );
        
        // 优先使用新字段，为空则回退到旧字段
        const values = products
          .map((p: any) => p.newValue !== null && p.newValue !== undefined ? p.newValue : p.oldValue)
          .filter((v: number | null): v is number => v !== null && v !== undefined && !isNaN(v));
        
        const stats = calculateFiveNumberStats(values);
        const resolvedGroupName = groupName ?? '';
        strategies.push({
          strategyType,
          strategyName,
          groupName,
          groupSortOrder: primarySortOrder.get(resolvedGroupName) ?? 999, // 默认排序值
          totalCount: products.length,
          ...stats,
        });
      } else {
        // 正常查询
        products = await prisma.$queryRawUnsafe(
          `SELECT "${actualMetric}" as value FROM FundProduct WHERE dataDate = ? AND strategyType = ?`,
          targetTimestamp,
          strategyType
        );

        // 计算五数统计
        const values = products
          .map((p: any) => p.value)
          .filter((v: number | null): v is number => v !== null && v !== undefined && !isNaN(v));

        const stats = calculateFiveNumberStats(values);
        const resolvedGroupName = groupName ?? '';
        strategies.push({
          strategyType,
          strategyName,
          groupName,
          groupSortOrder: primarySortOrder.get(resolvedGroupName) ?? 999, // 默认排序值
          totalCount: products.length,
          ...stats,
        });
      }
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