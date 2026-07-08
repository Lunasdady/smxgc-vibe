import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import dayjs from 'dayjs';

// 强制动态渲染，不使用静态缓存
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 获取最新数据日期
    const latest = await prisma.fundProduct.findFirst({
      orderBy: { dataDate: 'desc' },
      select: { dataDate: true },
    });

    // 获取总记录数
    const totalRecords = await prisma.fundProduct.count();

    // 获取各策略统计
    const strategyStats = await prisma.fundProduct.groupBy({
      by: ['strategyType'],
      _count: true,
    });

    return NextResponse.json({
      latestDate: latest ? dayjs(latest.dataDate).format('YYYY-MM-DD') : null,
      totalRecords,
      strategyStats: strategyStats.map((s) => ({
        strategyType: s.strategyType,
        count: s._count,
      })),
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}