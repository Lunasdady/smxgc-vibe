import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getStrategyType } from '@/lib/strategy-type-utils';

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

    // 使用 raw SQL upsert 来绕过类型检查
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
      primaryStrategy || '',
      secondaryStrategy || '',
      category || '',
      fundManager || null,
      managerScale || null,
      latestNav.productName,
      primaryStrategy || '',
      secondaryStrategy || '',
      category || '',
      fundManager || null,
      managerScale || null
    );

    const strategyMapping = {
      productCode,
      productName: latestNav.productName,
      primaryStrategy: primaryStrategy || '',
      secondaryStrategy: secondaryStrategy || '',
      category: category || '',
      fundManager: fundManager || null,
      managerScale: managerScale || null,
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
      console.log(`✅ 同步更斨FundProduct.strategyType: ${productCode} -> ${newStrategyType}`);
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
