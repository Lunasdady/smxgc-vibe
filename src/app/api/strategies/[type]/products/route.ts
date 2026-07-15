import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
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
        return NextResponse.json({ products: [], total: 0, page, limit, totalPages: 0 });
      }
    }
    // 如果访问的是旧期货策略但日期在截止日后，映射到新CTA策略
    else if (date >= cutoffDate && OLD_FUTURES_STRATEGIES.includes(strategyType)) {
      if (strategyType === 'subjective-futures') actualStrategyType = 'subjective-cta';
      else if (strategyType === 'quantitative-futures') actualStrategyType = 'quantitative-cta';
    }

    // 构建查询条件
    const where: any = {
      dataDate: new Date(dataDate),
      strategyType: actualStrategyType,
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
