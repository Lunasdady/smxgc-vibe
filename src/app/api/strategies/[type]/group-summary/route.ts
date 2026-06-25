import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateFiveNumberStats } from '@/lib/stats';
import dayjs from 'dayjs';

export async function GET(
  request: Request,
  { params }: { params: { type: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    let dataDate = searchParams.get('dataDate');
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
        largeScale: { count: 0, min: null, q25: null, mean: null, q75: null, max: null },
        smallScale: { count: 0, min: null, q25: null, mean: null, q75: null, max: null },
      });
    }

    // 查询 100 亿以上产品
    const largeScaleProducts = await prisma.fundProduct.findMany({
      where: {
        dataDate: new Date(dataDate),
        strategyType,
        isLargeScale: true,
      },
      select: { weeklyReturn: true },
    });

    // 查询 100 亿以下产品
    const smallScaleProducts = await prisma.fundProduct.findMany({
      where: {
        dataDate: new Date(dataDate),
        strategyType,
        isLargeScale: false,
      },
      select: { weeklyReturn: true },
    });

    const largeReturns = largeScaleProducts
      .map((p: { weeklyReturn: number | null }) => p.weeklyReturn)
      .filter((v: number | null): v is number => v !== null);

    const smallReturns = smallScaleProducts
      .map((p: { weeklyReturn: number | null }) => p.weeklyReturn)
      .filter((v: number | null): v is number => v !== null);

    return NextResponse.json({
      largeScale: calculateFiveNumberStats(largeReturns),
      smallScale: calculateFiveNumberStats(smallReturns),
    });
  } catch (error) {
    console.error('Error fetching group summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group summary' },
      { status: 500 }
    );
  }
}
