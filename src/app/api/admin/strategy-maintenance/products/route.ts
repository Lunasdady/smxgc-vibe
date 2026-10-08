import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * 获取产品列表（显示15天内有净值更新的产品）
 */
export async function GET() {
  try {
    console.log('🔍 开始查询15天内有净值的产品...');
    
    // 计算15天前的日期
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0); // 设置为当天0点
    
    console.log(`📅 15天前日期: ${fifteenDaysAgo.toLocaleDateString('zh-CN')}`);
    
    // 查询15天内有净值的所有记录
    const recentNavData = await prisma.navData.findMany({
      where: {
        navDate: {
          gte: fifteenDaysAgo,
        },
      },
      select: {
        productCode: true,
        productName: true,
        navDate: true,
      },
      orderBy: {
        navDate: 'desc',
      },
    });

    console.log(`📊 获取到 ${recentNavData.length} 条15天内的净值记录`);

    // 手动groupBy，每个产品只保留最新的净值
    const productMap = new Map<string, any>();
    recentNavData.forEach(nav => {
      if (!productMap.has(nav.productCode)) {
        productMap.set(nav.productCode, {
          productCode: nav.productCode,
          productName: nav.productName,
          latestNavDate: nav.navDate,
        });
      }
    });

    const products = Array.from(productMap.values());
    console.log(`📦 去重后 ${products.length} 个活跃产品`);

    // 获取所有产品的策略类型
    const productCodes = products.map((p: any) => p.productCode);
    const strategyMappings = await prisma.strategyMapping.findMany({
      where: {
        productCode: {
          in: productCodes,
        },
      },
    });

    console.log(`🏷️ 获取到 ${strategyMappings.length} 个策略映射`);

    // 构建策略类型映射
    const strategyMap = new Map<string, any>();
    strategyMappings.forEach((mapping: any) => {
      strategyMap.set(mapping.productCode, {
        primaryStrategy: mapping.primaryStrategy,
        secondaryStrategy: mapping.secondaryStrategy,
        category: mapping.category,
        fundManager: mapping.fundManager,
        managerScale: mapping.managerScale,
      });
    });

    // 组装返回数据
    const today = new Date();
    const result = products.map((p: any, index: number) => {
      const latestNavDate = p.latestNavDate;
      const daysSinceLatestNav = latestNavDate 
        ? Math.floor(
            (today.getTime() - new Date(latestNavDate).getTime()) / (1000 * 60 * 60 * 24)
          )
        : 999;

      const strategies = strategyMap.get(p.productCode) || {};

      return {
        id: index + 1,
        productCode: p.productCode,
        productName: p.productName,
        primaryStrategy: strategies.primaryStrategy || '',
        secondaryStrategy: strategies.secondaryStrategy || '',
        category: strategies.category || '',
        fundManager: strategies.fundManager || '',
        managerScale: strategies.managerScale || '',
        latestNavDate: latestNavDate ? new Date(latestNavDate).toISOString().split('T')[0] : '',
        daysSinceLatestNav,
      };
    });

    console.log(`✅ 返回 ${result.length} 个产品`);
    return NextResponse.json({ products: result });
  } catch (error: any) {
    console.error('❌ 获取产品列表失败:', error);
    return NextResponse.json(
      { error: '获取产品列表失败', details: error.message },
      { status: 500 }
    );
  }
}
