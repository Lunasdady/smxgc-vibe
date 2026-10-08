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

    if (!productCode) {
      return NextResponse.json(
        { error: '缺少产品代码参数' },
        { status: 400 }
      );
    }

    // 计算6个月前的日期
    const startDate = dayjs().subtract(months, 'month').startOf('month').toDate();

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

    // 获取近6个月的净值数据
    const navData = await prisma.navData.findMany({
      where: {
        productCode,
        navDate: {
          gte: startDate,
        },
      },
      orderBy: { navDate: 'asc' },
      select: {
        navDate: true,
        unitNav: true,
        cumulativeNav: true,
      },
    });

    // 过滤出周五的数据
    const fridayNavData = navData.filter(item => {
      const dayOfWeek = dayjs(item.navDate).day();
      return dayOfWeek === 5; // 5表示周五
    });

    // 格式化返回数据
    const formattedData = fridayNavData
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
      category: product.category,
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
