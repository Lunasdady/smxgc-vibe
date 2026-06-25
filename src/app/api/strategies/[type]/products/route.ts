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
    
    // 分页参数
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'weeklyReturn';
    const order = searchParams.get('order') || 'desc';

    // 如果没有指定日期，使用最新日期
    if (!dataDate) {
      const latest = await prisma.fundProduct.findFirst({
        orderBy: { dataDate: 'desc' },
        select: { dataDate: true },
      });
      dataDate = latest ? dayjs(latest.dataDate).format('YYYY-MM-DD') : null;
    }

    if (!dataDate) {
      return NextResponse.json({ products: [], total: 0, page, limit, totalPages: 0 });
    }

    // 构建查询条件
    const where: any = {
      dataDate: new Date(dataDate),
      strategyType,
    };

    if (search) {
      where.fundManager = {
        contains: search,
      };
    }

    // 构建排序
    const orderBy: any = {};
    orderBy[sortBy] = order;

    // 查询总数
    const total = await prisma.fundProduct.count({ where });

    // 查询数据
    const products = await prisma.fundProduct.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      products,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
