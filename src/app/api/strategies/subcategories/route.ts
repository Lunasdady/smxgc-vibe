import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// 强制动态渲染，不使用静态缓存
export const dynamic = 'force-dynamic';

/**
 * 获取指定策略类型对应的二级策略列表
 * 通过 StrategyMapping 反向查找一级策略，再查询 StrategyDictionary
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyType = searchParams.get('strategyType');

    if (!strategyType) {
      return NextResponse.json({ subcategories: [] });
    }

    // 对于自定义策略（custom-xxx），提取二级策略名称
    if (strategyType.startsWith('custom-')) {
      const secondaryName = strategyType.replace('custom-', '');
      // 查询该二级策略对应的一级策略
      const dictEntry = await prisma.strategyDictionary.findFirst({
        where: {
          level: 2,
          strategyName: secondaryName,
        },
        select: { parentStrategy: true },
      });

      if (!dictEntry?.parentStrategy) {
        return NextResponse.json({ subcategories: [] });
      }

      // 查询该一级策略下的所有二级策略
      const subcategories = await prisma.strategyDictionary.findMany({
        where: {
          level: 2,
          parentStrategy: dictEntry.parentStrategy,
        },
        select: { strategyName: true },
        orderBy: { sortOrder: 'asc' },
      });

      return NextResponse.json({
        subcategories: subcategories.map((s) => s.strategyName),
      });
    }

    // 对于预定义策略，通过 StrategyMapping 找到一个样本产品，获取一级策略
    // 先查询 FundProduct 中该 strategyType 的一个产品
    const sampleProduct = await prisma.fundProduct.findFirst({
      where: { strategyType },
      select: { productName: true },
    });

    if (!sampleProduct) {
      return NextResponse.json({ subcategories: [] });
    }

    // 通过 productName 关联 StrategyMapping 获取一级策略
    const mapping = await prisma.strategyMapping.findFirst({
      where: { productName: sampleProduct.productName },
      select: { primaryStrategy: true },
    });

    if (!mapping?.primaryStrategy) {
      return NextResponse.json({ subcategories: [] });
    }

    // 查询该一级策略下的所有二级策略
    const subcategories = await prisma.strategyDictionary.findMany({
      where: {
        level: 2,
        parentStrategy: mapping.primaryStrategy,
      },
      select: { strategyName: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      subcategories: subcategories.map((s) => s.strategyName),
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subcategories' },
      { status: 500 }
    );
  }
}
