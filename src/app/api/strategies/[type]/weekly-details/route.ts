import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
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
      return NextResponse.json({ details: [] });
    }

    // 将日期转为 Unix 时间戳（毫秒），因为数据库中 dataDate 存的是整数
    const targetTimestamp = new Date(dataDate + 'T00:00:00.000Z').getTime();

    // 指增策略超额收益字段回退映射
    const indexEnhancedTypes = ['index-enhanced-300', 'index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
    const isIndexEnhanced = indexEnhancedTypes.includes(strategyType);
    const needsFallback = isIndexEnhanced && new Date(dataDate) >= new Date('2026-07-08') && metric.startsWith('excess');
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

    // 查询该策略下的所有产品，只返回需要的字段（使用 COALESCE 回退）
    const products = await prisma.$queryRawUnsafe<any[]>(
      oldMetric
        ? `SELECT fundManager, productName, COALESCE("${metric}", "${oldMetric}") as value FROM FundProduct WHERE dataDate = ${targetTimestamp} AND strategyType = '${strategyType}' ORDER BY COALESCE("${metric}", "${oldMetric}") DESC`
        : `SELECT fundManager, productName, "${metric}" as value FROM FundProduct WHERE dataDate = ${targetTimestamp} AND strategyType = '${strategyType}' ORDER BY "${metric}" DESC`
    );

    const details = products.map((p: any) => ({
      fundManager: p.fundManager,
      productName: p.productName,
      value: p.value,
    }));

    return NextResponse.json({ details });
  } catch (error) {
    console.error('Error fetching weekly details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly details' },
      { status: 500 }
    );
  }
}