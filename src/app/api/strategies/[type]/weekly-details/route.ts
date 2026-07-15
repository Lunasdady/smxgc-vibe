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

    // 查询该策略下的所有产品，只返回需要的字段
    const products = await prisma.fundProduct.findMany({
      where: {
        dataDate: new Date(dataDate),
        strategyType,
      },
      select: {
        fundManager: true,
        productName: true,
        [metric]: true,
      } as any,
      orderBy: {
        [metric]: 'desc',
      } as any,
    });

    const details = products.map((p: any) => ({
      fundManager: p.fundManager,
      productName: p.productName,
      value: p[metric],
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