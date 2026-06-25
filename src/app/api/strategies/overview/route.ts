import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateFiveNumberStats } from '@/lib/stats';
import { STRATEGY_NAME_MAP } from '@/lib/types';
import dayjs from 'dayjs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let dataDate = searchParams.get('dataDate');

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

    // 获取该日期的所有策略类型
    const strategyTypes = Object.keys(STRATEGY_NAME_MAP);
    const strategies = [];

    for (const strategyType of strategyTypes) {
      // 查询该策略类型的所有产品
      const products = await prisma.fundProduct.findMany({
        where: {
          dataDate: new Date(dataDate),
          strategyType,
        },
        select: {
          weeklyReturn: true,
        },
      });

      // 计算五数统计
      const weeklyReturns = products
        .map((p: { weeklyReturn: number | null }) => p.weeklyReturn)
        .filter((v: number | null): v is number => v !== null);

      const stats = calculateFiveNumberStats(weeklyReturns);

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