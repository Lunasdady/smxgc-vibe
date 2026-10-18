import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getStrategyType } from '@/lib/strategy-type-utils';
import { calculateAllMetrics } from '@/lib/metrics-calculator';
import dayjs from 'dayjs';

/**
 * 重新计算单个产品的所有历史周五指标数据
 */
async function recalculateProductMetrics(
  productCode: string,
  productName: string,
  strategyType: string
) {
  console.log(`🔄 开始重新计算产品 ${productCode} 的历史指标...`);

  // 获取该产品所有的净值日期（只取周五）
  const navDates = await prisma.$queryRawUnsafe<{ navDate: Date }[]>(
    `SELECT DISTINCT navDate FROM NavData WHERE productCode = ? AND navDate IS NOT NULL ORDER BY navDate ASC`,
    productCode
  );

  // 筛选出周五的数据
  const fridays = navDates.filter(n => new Date(n.navDate).getDay() === 5);

  console.log(`📊 找到 ${fridays.length} 个周五数据`);

  let successCount = 0;
  let skipCount = 0;

  for (const { navDate } of fridays) {
    try {
      // 获取该日期前6个月的净值数据
      const targetDate = new Date(navDate);
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

      if (navData.length < 2) {
        skipCount++;
        continue;
      }

      // 计算指标
      const formattedNavData = navData
        .filter(n => n.unitNav !== null)
        .map(n => ({
          navDate: n.navDate,
          unitNav: n.unitNav as number,
        }));

      const metrics = calculateAllMetrics(formattedNavData, targetDate);

      // 使用 UTC 时间戳，与 calculate-metrics API 保持一致
      const utcTimestamp = Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate()
      );

      // 更盙或创建 FundProduct 记录
      await prisma.$executeRawUnsafe(
        `INSERT INTO FundProduct (productCode, dataDate, strategyType, fundManager, managerScale, isLargeScale, productName, weeklyReturn, monthlyReturn, ytdReturn, annualizedReturnSinceInception, ytdMaxDrawdown, inceptionMaxDrawdown, annualizedVolatility, sharpeRatio)
         VALUES (?, ?, ?, '', '', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(productCode, dataDate) DO UPDATE SET
           strategyType = ?,
           weeklyReturn = ?,
           monthlyReturn = ?,
           ytdReturn = ?,
           annualizedReturnSinceInception = ?,
           ytdMaxDrawdown = ?,
           inceptionMaxDrawdown = ?,
           annualizedVolatility = ?,
           sharpeRatio = ?`,
        productCode,
        utcTimestamp,
        strategyType,
        productName,
        metrics.weeklyReturn,
        metrics.monthlyReturn,
        metrics.ytdReturn,
        metrics.annualizedReturnSinceInception,
        metrics.ytdMaxDrawdown,
        metrics.inceptionMaxDrawdown,
        metrics.annualizedVolatility,
        metrics.sharpeRatio,
        strategyType,
        metrics.weeklyReturn,
        metrics.monthlyReturn,
        metrics.ytdReturn,
        metrics.annualizedReturnSinceInception,
        metrics.ytdMaxDrawdown,
        metrics.inceptionMaxDrawdown,
        metrics.annualizedVolatility,
        metrics.sharpeRatio
      );

      successCount++;
    } catch (error) {
      console.error(`❌ 计算 ${productCode} ${navDate} 失败:`, error);
    }
  }

  console.log(`✅ 产品 ${productCode} 计算完成: 成功 ${successCount} 个, 跳过 ${skipCount} 个`);
}

/**
 * 更新单个产品的策略类型（支持一级和二级策略）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productCode, primaryStrategy, secondaryStrategy, category, fundManager, managerScale } = body;

    if (!productCode) {
      return NextResponse.json(
        { error: '缺少必要参数: productCode' },
        { status: 400 }
      );
    }

    // 获取产品信息（从NavData表中查找最新的产品名称）
    const latestNav = await prisma.navData.findFirst({
      where: { productCode },
      select: {
        productCode: true,
        productName: true,
      },
      orderBy: {
        navDate: 'desc',
      },
    });

    if (!latestNav) {
      return NextResponse.json(
        { error: '产品不存在' },
        { status: 404 }
      );
    }

    // 构建更新数据
    const updateData: any = {
      productName: latestNav.productName,
    };

    if (primaryStrategy !== undefined) {
      updateData.primaryStrategy = primaryStrategy;
    }

    if (secondaryStrategy !== undefined) {
      updateData.secondaryStrategy = secondaryStrategy;
    }

    if (category !== undefined) {
      updateData.category = category;
    }

    if (fundManager !== undefined) {
      updateData.fundManager = fundManager || null;
    }

    if (managerScale !== undefined) {
      updateData.managerScale = managerScale || null;
    }

    // 先查询现有的 StrategyMapping
    const existingMapping = await prisma.$queryRawUnsafe<{
      primaryStrategy: string;
      secondaryStrategy: string;
      category: string;
      fundManager: string | null;
      managerScale: string | null;
    }[]>(
      `SELECT primaryStrategy, secondaryStrategy, category, fundManager, managerScale FROM StrategyMapping WHERE productCode = ?`,
      productCode
    );

    // 合并新旧值
    const mergedPrimaryStrategy = primaryStrategy !== undefined ? primaryStrategy : (existingMapping[0]?.primaryStrategy || '');
    const mergedSecondaryStrategy = secondaryStrategy !== undefined ? secondaryStrategy : (existingMapping[0]?.secondaryStrategy || '');
    const mergedCategory = category !== undefined ? category : (existingMapping[0]?.category || '');
    const mergedFundManager = fundManager !== undefined ? fundManager : (existingMapping[0]?.fundManager || null);
    const mergedManagerScale = managerScale !== undefined ? managerScale : (existingMapping[0]?.managerScale || null);

    // 使用 raw SQL upsert
    await prisma.$executeRawUnsafe(
      `INSERT INTO StrategyMapping (productCode, productName, primaryStrategy, secondaryStrategy, category, fundManager, managerScale, updatedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(productCode) DO UPDATE SET
         productName = ?,
         primaryStrategy = ?,
         secondaryStrategy = ?,
         category = ?,
         fundManager = ?,
         managerScale = ?,
         updatedAt = datetime('now')`,
      productCode,
      latestNav.productName,
      mergedPrimaryStrategy,
      mergedSecondaryStrategy,
      mergedCategory,
      mergedFundManager,
      mergedManagerScale,
      latestNav.productName,
      mergedPrimaryStrategy,
      mergedSecondaryStrategy,
      mergedCategory,
      mergedFundManager,
      mergedManagerScale
    );

    const strategyMapping = {
      productCode,
      productName: latestNav.productName,
      primaryStrategy: mergedPrimaryStrategy,
      secondaryStrategy: mergedSecondaryStrategy,
      category: mergedCategory,
      fundManager: mergedFundManager,
      managerScale: mergedManagerScale,
    };

    // 同步更斨FundProduct表的strategyType字段（使用最新的策略映射）
    const newStrategyType = getStrategyType(
      (strategyMapping as any).primaryStrategy,
      (strategyMapping as any).secondaryStrategy
    );
    
    if (newStrategyType) {
      // 使用 raw SQL 绕过类型检查
      await prisma.$executeRawUnsafe(
        `UPDATE FundProduct SET strategyType = ? WHERE productCode = ?`,
        newStrategyType,
        productCode
      );
      console.log(`✅ 同步更新FundProduct.strategyType: ${productCode} -> ${newStrategyType}`);
    
      // 重新计算该产品的所有历史周五数据
      await recalculateProductMetrics(productCode, latestNav.productName, newStrategyType);
    }

    return NextResponse.json({
      success: true,
      productName: latestNav.productName,
      productCode: productCode,
      primaryStrategy: (strategyMapping as any).primaryStrategy,
      secondaryStrategy: (strategyMapping as any).secondaryStrategy,
      category: (strategyMapping as any).category,
      fundManager: (strategyMapping as any).fundManager,
      managerScale: (strategyMapping as any).managerScale,
      message: `策略已更新，${newStrategyType ? '产品已移至: ' + newStrategyType : '策略类型未变更'}`,
    });
  } catch (error: any) {
    console.error('更新策略类型失败:', error);
    return NextResponse.json(
      { error: '更新策略类型失败', details: error.message },
      { status: 500 }
    );
  }
}
