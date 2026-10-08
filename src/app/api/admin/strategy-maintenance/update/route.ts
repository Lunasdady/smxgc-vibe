import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

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

    // 更新或创建策略映射
    const strategyMapping = await prisma.strategyMapping.upsert({
      where: {
        productCode: productCode,
      },
      update: updateData,
      create: {
        productCode: productCode,
        productName: latestNav.productName,
        primaryStrategy: primaryStrategy || '',
        secondaryStrategy: secondaryStrategy || '',
        category: category || '',
        fundManager: fundManager || null,
        managerScale: managerScale || null,
      },
    });

    return NextResponse.json({
      success: true,
      productName: latestNav.productName,
      productCode: productCode,
      primaryStrategy: strategyMapping.primaryStrategy,
      secondaryStrategy: strategyMapping.secondaryStrategy,
      category: strategyMapping.category,
      fundManager: strategyMapping.fundManager,
      managerScale: strategyMapping.managerScale,
    });
  } catch (error: any) {
    console.error('更新策略类型失败:', error);
    return NextResponse.json(
      { error: '更新策略类型失败', details: error.message },
      { status: 500 }
    );
  }
}
