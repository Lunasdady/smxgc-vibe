import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * 测试API - 验证动态策略统计功能
 */
export async function GET(request: Request) {
  try {
    console.log('[Test API] 开始测试动态策略统计...');
    
    // 1. 测试获取一级策略
    const primaryStrategies = await prisma.strategyDictionary.findMany({
      where: {
        level: 1,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    console.log('[Test API] 一级策略数量:', primaryStrategies.length);

    // 2. 测试获取StrategyMapping
    const mappingCount = await prisma.strategyMapping.count({
      where: {
        primaryStrategy: primaryStrategies[0]?.strategyName,
      },
    });

    console.log('[Test API] 第一个策略的产品数量:', mappingCount);

    return NextResponse.json({
      success: true,
      primaryStrategyCount: primaryStrategies.length,
      primaryStrategies: primaryStrategies.slice(0, 3), // 只返回前3个
      firstStrategyProductCount: mappingCount,
      message: 'API测试成功',
    });
  } catch (error: any) {
    console.error('[Test API] 错误:', error);
    return NextResponse.json(
      { 
        error: '测试失败', 
        details: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}
