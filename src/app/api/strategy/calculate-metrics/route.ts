import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateAllMetrics, calculateExcessMetrics } from '@/lib/metrics-calculator';
import dayjs from 'dayjs';

/**
 * 计算并更新产品收益指标
 * 在净值数据更新后调用，自动计算所有收益指标
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productCode, dataDate } = body;

    if (!productCode) {
      return NextResponse.json(
        { error: '缺少产品代码参数' },
        { status: 400 }
      );
    }

    // 获取产品信息
    const product = await prisma.strategyMapping.findUnique({
      where: { productCode },
    });

    if (!product) {
      return NextResponse.json(
        { error: '产品不存在' },
        { status: 404 }
      );
    }

    // 获取近6个月的净值数据
    const targetDate = dataDate ? new Date(dataDate) : new Date();
    const startDate = dayjs(targetDate).subtract(6, 'month').toDate();

    const navData = await prisma.navData.findMany({
      where: {
        productCode,
        navDate: {
          gte: startDate,
          lte: targetDate,
        },
      },
      orderBy: { navDate: 'asc' },
    });

    if (navData.length === 0) {
      return NextResponse.json(
        { error: '无净值数据，无法计算指标' },
        { status: 400 }
      );
    }

    // 格式化净值数据
    const formattedNavData = navData
      .filter(n => n.unitNav !== null)
      .map(n => ({
        navDate: n.navDate,
        unitNav: n.unitNav as number,
      }));

    // 计算普通策略指标
    const metrics = calculateAllMetrics(formattedNavData, targetDate);

    // 判断是否为指增策略，需要计算超额收益
    const isIndexEnhanced = product.secondaryStrategy?.includes('指增');
    let excessMetrics = null;

    if (isIndexEnhanced) {
      // 获取基准指数
      const indexMapping = await prisma.indexMapping.findUnique({
        where: { secondaryStrategy: product.secondaryStrategy },
      });

      if (indexMapping) {
        // 获取指数数据
        const indexNavData = await prisma.indexData.findMany({
          where: {
            indexCode: indexMapping.indexCode,
            tradeDate: {
              gte: startDate,
              lte: targetDate,
            },
          },
          orderBy: { tradeDate: 'asc' },
        });

        const formattedIndexNavData = indexNavData.map(n => ({
          navDate: n.tradeDate,
          unitNav: n.closePrice,
        }));

        // 计算超额收益指标
        excessMetrics = calculateExcessMetrics(formattedNavData, formattedIndexNavData, targetDate);
      }
    }

    // 更新或创建FundProduct记录
    const updateData: any = {
      dataDate: targetDate,
      strategyType: getStrategyType(product.primaryStrategy, product.secondaryStrategy),
      fundManager: '', // 从其他数据源获取
      managerScale: '',
      isLargeScale: false,
      productName: product.productName,
      ...metrics,
    };

    // 如果是指数增强策略，添加超额指标
    if (excessMetrics) {
      Object.assign(updateData, excessMetrics);
    }

    // Upsert到FundProduct表
    await prisma.fundProduct.upsert({
      where: {
        productCode_dataDate: {
          productCode,
          dataDate: targetDate,
        },
      },
      update: updateData,
      create: {
        productCode,
        productName: product.productName,
        ...updateData,
      },
    });

    return NextResponse.json({
      success: true,
      productCode,
      productName: product.productName,
      metrics,
      excessMetrics,
      message: '收益指标计算完成',
    });
  } catch (error: any) {
    console.error('计算收益指标失败:', error);
    return NextResponse.json(
      { error: '计算收益指标失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 根据策略名称获取策略类型
 */
function getStrategyType(primaryStrategy: string, secondaryStrategy: string): string {
  const ps = primaryStrategy || '';
  const ss = secondaryStrategy || '';

  // 指增策略
  if (ps.includes('指增')) {
    if (ss.includes('300')) return 'index-enhanced-300';
    if (ss.includes('500') && !ss.includes('A500')) return 'index-enhanced-500';
    if (ss.includes('1000')) return 'index-enhanced-1000';
    if (ss.includes('2000')) return 'index-enhanced-2000';
    if (ss.includes('另类') || ss.includes('红利') || ss.includes('A500')) return 'index-enhanced-alternative';
    return 'index-enhanced-500';
  }

  // 主观多头
  if (ps.includes('主观多头') || ss.includes('主观多头')) return 'subjective-long';

  // 量化选股
  if (ps.includes('量化选股') || ss.includes('量化选股')) return 'quantitative-stock-selection';

  // 择时&多空
  if (ps.includes('择时') || ps.includes('多空') || ss.includes('择时') || ss.includes('多空')) return 'timing-long-short';

  // 市场中性&T0
  if (ps.includes('市场中性') || ps.includes('T0') || ss.includes('市场中性') || ss.includes('T0')) return 'market-neutral-t0';

  // 可转债多头
  if (ps.includes('可转债') || ss.includes('可转债')) return 'convertible-bond-long';

  // 套利策略
  if (ps.includes('套利') || ss.includes('套利') || ss.includes('ETF')) return 'arbitrage';

  // 宏观策略
  if (ps.includes('宏观') || ss.includes('宏观')) return 'macro-strategy';

  // 复合策略
  if (ps.includes('复合') && !ps.includes('CTA')) return 'composite-strategy';

  // 强势股
  if (ps.includes('强势') || ss.includes('强势')) return 'strong-stock';

  // CTA策略（根据日期动态判断期货/CTA）
  if (ps.includes('CTA') || ss.includes('CTA')) {
    if (ps.includes('主观') || ss.includes('主观')) return 'subjective-cta';
    if (ps.includes('量化') || ss.includes('量化') || ss.includes('时序') || ss.includes('中高频')) return 'quantitative-cta';
    if (ps.includes('复合') || ss.includes('复合')) return 'composite-cta';
    return 'quantitative-cta';
  }

  // 默认返回指增500
  return 'index-enhanced-500';
}

/**
 * 批量计算所有产品的收益指标
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { category, dataDate } = body;

    // 获取指定分类的所有产品
    const products = await prisma.strategyMapping.findMany({
      where: {
        category: category || '观察池',
      },
    });

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
      try {
        // 调用计算逻辑
        const targetDate = dataDate ? new Date(dataDate) : new Date();
        const startDate = dayjs(targetDate).subtract(6, 'month').toDate();

        const navData = await prisma.navData.findMany({
          where: {
            productCode: product.productCode,
            navDate: {
              gte: startDate,
              lte: targetDate,
            },
          },
          orderBy: { navDate: 'asc' },
        });

        if (navData.length === 0) {
          failCount++;
          continue;
        }

        const formattedNavData = navData
          .filter(n => n.unitNav !== null)
          .map(n => ({
            navDate: n.navDate,
            unitNav: n.unitNav as number,
          }));

        const metrics = calculateAllMetrics(formattedNavData, targetDate);

        // 更新到FundProduct表
        await prisma.fundProduct.upsert({
          where: {
            productCode_dataDate: {
              productCode: product.productCode,
              dataDate: targetDate,
            },
          },
          update: {
            ...metrics,
          },
          create: {
            productCode: product.productCode,
            productName: product.productName,
            dataDate: targetDate,
            strategyType: getStrategyType(product.primaryStrategy, product.secondaryStrategy),
            fundManager: '',
            managerScale: '',
            isLargeScale: false,
            ...metrics,
          },
        });

        successCount++;
        results.push({
          productCode: product.productCode,
          productName: product.productName,
          status: 'success',
        });
      } catch (error) {
        failCount++;
        results.push({
          productCode: product.productCode,
          productName: product.productName,
          status: 'failed',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalProducts: products.length,
      successCount,
      failCount,
      results,
      message: `批量计算完成：成功${successCount}个，失败${failCount}个`,
    });
  } catch (error: any) {
    console.error('批量计算收益指标失败:', error);
    return NextResponse.json(
      { error: '批量计算收益指标失败', details: error.message },
      { status: 500 }
    );
  }
}
