import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
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
      return NextResponse.json({ details: [] });
    }

    // 查询该策略下的所有产品，只返回需要的字段
    const products = await prisma.fundProduct.findMany({
      where: {
        dataDate: new Date(dataDate),
        strategyType,
      },
      select: {
        fundManager: true,
        productName: true,
        weeklyReturn: true,
      },
      orderBy: {
        weeklyReturn: 'desc',
      },
    });

    const details = products.map((p: { fundManager: string; productName: string; weeklyReturn: number | null }) => ({
      fundManager: p.fundManager,
      productName: p.productName,
      weeklyReturn: p.weeklyReturn,
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