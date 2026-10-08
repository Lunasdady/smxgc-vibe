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

    // 将日期转为 Unix 时间戳（毫秒），因为数据库中 dataDate 存的是整数
    const targetTimestamp = new Date(dataDate + 'T00:00:00.000Z').getTime();

    // 构建 WHERE 条件
    let whereClause = `WHERE dataDate = ${targetTimestamp} AND strategyType = '${actualStrategyType}'`;
    if (search) {
      whereClause += ` AND fundManager LIKE '%${search.replace(/'/g, "''")}%'`;
    }

    // 查询总数
    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM FundProduct ${whereClause}`
    );
    const total = Number(countResult[0]?.count || 0);

    // 查询数据（使用 raw SQL 排序和分页）
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM FundProduct ${whereClause} ORDER BY "${sortBy}" ${order === 'desc' ? 'DESC' : 'ASC'} LIMIT ${limit} OFFSET ${(page - 1) * limit}`
    );

    // 为每个产品添加productCode和strategyCategory（通过产品名称关联StrategyMapping）
    const productsWithCode = await Promise.all(
      products.map(async (product) => {
        // 查找匹配的StrategyMapping记录
        const mapping = await prisma.strategyMapping.findFirst({
          where: {
            productName: product.productName,
          },
          select: {
            productCode: true,
            secondaryStrategy: true,
          },
        });

        return {
          ...product,
          productCode: mapping?.productCode || null,
          strategyCategory: mapping?.secondaryStrategy || product.strategyCategory || '-',
        };
      })
    );

    // 指增策略超额收益字段回退：当 excess 字段为空时，使用对应的绝对收益字段
    const indexEnhancedTypes = ['index-enhanced-300', 'index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
    const isIndexEnhanced = indexEnhancedTypes.includes(strategyType);
    const needsFallback = isIndexEnhanced && date >= new Date('2026-07-08');

    if (needsFallback) {
      const fallbackMap: Record<string, string> = {
        excessReturn1w: 'weeklyReturn',
        excessReturn3m: 'monthlyReturn',
        excessReturnYtd: 'ytdReturn',
        excessAnnualizedReturn: 'annualizedReturnSinceInception',
        excessYtdMaxDrawdown: 'ytdMaxDrawdown',
        excessInceptionMaxDrawdown: 'inceptionMaxDrawdown',
        excessAnnualizedVolatility: 'annualizedVolatility',
        excessSharpeRatio: 'sharpeRatio',
      };
      for (const product of productsWithCode) {
        for (const [newField, oldField] of Object.entries(fallbackMap)) {
          if ((product[newField] === null || product[newField] === undefined) && product[oldField] !== null && product[oldField] !== undefined) {
            product[newField] = product[oldField];
          }
        }
      }
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      products: productsWithCode,
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
