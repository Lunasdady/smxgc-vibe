import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';

/**
 * 导出产品策略类型为Excel（导出15天内有净值的所有产品）
 */
export async function GET() {
  try {
    console.log('📤 开始导出产品策略类型...');
    
    // 计算15天前的日期
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0);
    
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

    // 准备Excel数据（导出所有产品，包括未设置策略的）
    const data = products.map((p: any, index: number) => {
      const strategies = strategyMap.get(p.productCode) || {};
      return {
        '序号': index + 1,
        '产品代码': p.productCode,
        '产品名称': p.productName,
        '一级策略': strategies.primaryStrategy || '',
        '二级策略': strategies.secondaryStrategy || '',
        '分类分层': strategies.category || '',
        '基金管理人': strategies.fundManager || '',
        '管理人规模': strategies.managerScale || '',
      };
    });

    console.log(`✅ 准备导出 ${data.length} 条产品数据`);

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // 设置列宽
    ws['!cols'] = [
      { wch: 8 },   // 序号
      { wch: 15 },  // 产品代码
      { wch: 40 },  // 产品名称
      { wch: 15 },  // 一级策略
      { wch: 15 },  // 二级策略
      { wch: 12 },  // 分类分层
      { wch: 20 },  // 基金管理人
      { wch: 15 },  // 管理人规模
    ];

    XLSX.utils.book_append_sheet(wb, ws, '产品策略类型');

    // 生成Excel文件
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 🚨 修复：使用英文文件名，避免Content-Disposition中的中文字符问题
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const fileName = `strategy_mapping_${year}-${month}-${day}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('导出Excel失败:', error);
    return NextResponse.json(
      { error: '导出Excel失败', details: error.message },
      { status: 500 }
    );
  }
}
