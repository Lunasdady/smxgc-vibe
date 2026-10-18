import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import dayjs from 'dayjs';

/**
 * 获取产品净值走势数据（近6个月的周五数据）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');
    const months = parseInt(searchParams.get('months') || '6');
    const specificDate = searchParams.get('date'); // 指定日期（格式：YYYY-MM-DD）

    if (!productCode) {
      return NextResponse.json(
        { error: '缺少产品代码参数' },
        { status: 400 }
      );
    }

    // 获取产品基本信息
    const product = await prisma.strategyMapping.findFirst({
      where: { productCode },
      select: {
        productCode: true,
        productName: true,
        primaryStrategy: true,
        secondaryStrategy: true,
        category: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: '产品不存在' },
        { status: 404 }
      );
    }

    // 使用传入的日期或当前日期作为基准，计算6个月前的起始日期
    const baseDate = specificDate ? dayjs(specificDate) : dayjs();
    const startDate = baseDate.subtract(months, 'month').startOf('month').toDate();

    const navData = await prisma.navData.findMany({
      where: {
        productCode,
        navDate: {
          gte: startDate,
          lte: baseDate.endOf('day').toDate(),
        },
      },
      orderBy: { navDate: 'asc' },
      select: {
        navDate: true,
        unitNav: true,
        cumulativeNav: true,
      },
    });

    // 查询近6个月内系统有计算指标的所有日期（FundProduct中的distinct dataDate）
    const availableDatesResult: any[] = await prisma.$queryRaw`
      SELECT DISTINCT dataDate 
      FROM FundProduct 
      WHERE dataDate >= ${startDate.getTime()} AND dataDate <= ${baseDate.endOf('day').valueOf()}
      ORDER BY dataDate ASC
    `;

    // 构建可用日期集合（毫秒时间戳转字符串）
    const availableDateSet = new Set(
      availableDatesResult.map((d: any) => {
        const dateValue = new Date(Number(d.dataDate));
        return dayjs(dateValue).format('YYYY-MM-DD');
      })
    );

    // 过滤净值数据：只保留在 availableDateSet 中的日期
    const filteredNavData = navData.filter(item => {
      const dateStr = dayjs(item.navDate).format('YYYY-MM-DD');
      return availableDateSet.has(dateStr);
    });

    const formattedData = filteredNavData
      .filter(item => item.unitNav !== null)
      .map(item => ({
        date: dayjs(item.navDate).format('YYYY-MM-DD'),
        nav: item.unitNav,
        cumulativeNav: item.cumulativeNav,
      }));

    return NextResponse.json({
      success: true,
      productCode: product.productCode,
      productName: product.productName,
      primaryStrategy: product.primaryStrategy,
      secondaryStrategy: product.secondaryStrategy,
      category: (product as any).category,
      navData: formattedData,
      dataPoints: formattedData.length,
    });
  } catch (error: any) {
    console.error('获取产品走势数据失败:', error);
    return NextResponse.json(
      { error: '获取产品走势数据失败', details: error.message },
      { status: 500 }
    );
  }
}
