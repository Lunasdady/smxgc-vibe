import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * 获取动态策略统计信息
 * 根据策略字典动态返回一级策略、二级策略及产品统计
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetCategory = searchParams.get('category') || '观察池';
    const dataDate = searchParams.get('dataDate');

    // 1. 获取所有启用的一级策略
    const primaryStrategies = await prisma.strategyDictionary.findMany({
      where: {
        level: 1,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // 2. 获取所有策略映射
    const allMappings = await prisma.strategyMapping.findMany({});

    // 3. 在内存中按category过滤
    const filteredMappings = (allMappings as any[]).filter((m: any) => m.category === targetCategory);

    // 4. 构建返回结构
    const result = await Promise.all(
      primaryStrategies.map(async (primary) => {
        // 获取该一级策略下的所有二级策略
        const secondaryStrategies = await prisma.strategyDictionary.findMany({
          where: {
            level: 2,
            parentStrategy: primary.strategyName,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
        });

        // 过滤出该一级策略的产品
        const products = filteredMappings.filter(
          (m: any) => m.primaryStrategy === primary.strategyName
        );

        // 按二级策略分组
        const secondaryStats = secondaryStrategies.map((secondary) => {
          const secondaryProducts = products.filter(
            (p: any) => p.secondaryStrategy === secondary.strategyName
          );

          return {
            name: secondary.strategyName,
            productCount: secondaryProducts.length,
            products: (secondaryProducts as any[]).map((p: any) => ({
              productCode: p.productCode,
              productName: p.productName,
            })),
            stats: {},
          };
        });

        return {
          name: primary.strategyName,
          productCount: products.length,
          secondaryStrategies: secondaryStats,
        };
      })
    );

    return NextResponse.json({
      success: true,
      strategies: result,
      category: targetCategory,
      dataDate: dataDate || new Date().toISOString().split('T')[0],
    });
  } catch (error: any) {
    console.error('获取动态策略统计失败:', error);
    return NextResponse.json(
      { error: '获取动态策略统计失败', details: error.message },
      { status: 500 }
    );
  }
}
