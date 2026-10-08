import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  fetchIndexDataFromEastMoney, 
  convertToDatabaseFormat,
  getIndexName 
} from '@/lib/eastmoney-adapter';

/**
 * 获取指数数据列表
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const indexCode = searchParams.get('indexCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (indexCode) {
      where.indexCode = indexCode;
    }
    if (startDate && endDate) {
      where.tradeDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const indexData = await prisma.indexData.findMany({
      where,
      orderBy: { tradeDate: 'asc' },
    });

    return NextResponse.json({ indexData });
  } catch (error: any) {
    console.error('获取指数数据失败:', error);
    return NextResponse.json(
      { error: '获取指数数据失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 同步指数数据（从东方财富API获取）
 * 
 * 请求体:
 * {
 *   indexCode: string;      // 指数代码（如 000300.SH）
 *   startDate: string;      // 开始日期（YYYY-MM-DD）
 *   endDate: string;        // 结束日期（YYYY-MM-DD）
 *   syncAll?: boolean;      // 是否同步所有映射的指数
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { indexCode, startDate, endDate, syncAll } = body;

    let results: Array<{
      indexCode: string;
      indexName: string;
      syncedDays: number;
      success: boolean;
      error?: string;
    }> = [];

    // 同步所有映射的指数
    if (syncAll) {
      console.log('[Index Sync] 开始同步所有指数数据...');
      
      // 获取所有启用的映射
      const mappings = await prisma.indexMapping.findMany({
        where: { isActive: true },
      });

      console.log(`[Index Sync] 找到 ${mappings.length} 个映射`);

      // 为每个映射同步数据
      for (const mapping of mappings) {
        try {
          console.log(`[Index Sync] 同步 ${mapping.secondaryStrategy} -> ${mapping.indexCode}`);
          
          // 获取指数数据
          const data = await fetchIndexDataFromEastMoney(
            mapping.indexCode,
            startDate,
            endDate
          );

          console.log(`[Index Sync] 获取到 ${data.length} 条数据`);

          // 转换为数据库格式
          const dbData = convertToDatabaseFormat(mapping.indexCode, data);

          // 批量插入/更新
          let syncedCount = 0;
          for (const item of dbData) {
            await prisma.indexData.upsert({
              where: {
                indexCode_tradeDate: {
                  indexCode: item.indexCode,
                  tradeDate: item.tradeDate,
                },
              },
              update: {
                closePrice: item.closePrice,
                dailyReturn: item.dailyReturn,
              },
              create: item,
            });
            syncedCount++;
          }

          results.push({
            indexCode: mapping.indexCode,
            indexName: mapping.indexName,
            syncedDays: syncedCount,
            success: true,
          });

          console.log(`[Index Sync] 完成 ${mapping.indexCode}: ${syncedCount} 条`);

          // 请求间隔，避免频率限制
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          console.error(`[Index Sync] 失败 ${mapping.indexCode}:`, error);
          results.push({
            indexCode: mapping.indexCode,
            indexName: mapping.indexName,
            syncedDays: 0,
            success: false,
            error: error.message,
          });
        }
      }
    } 
    // 同步单个指数
    else if (indexCode) {
      console.log(`[Index Sync] 开始同步单个指数: ${indexCode}`);

      // 获取指数数据
      const data = await fetchIndexDataFromEastMoney(
        indexCode,
        startDate,
        endDate
      );

      console.log(`[Index Sync] 获取到 ${data.length} 条数据`);

      // 转换为数据库格式
      const dbData = convertToDatabaseFormat(indexCode, data);

      // 批量插入/更新
      let syncedCount = 0;
      for (const item of dbData) {
        await prisma.indexData.upsert({
          where: {
            indexCode_tradeDate: {
              indexCode: item.indexCode,
              tradeDate: item.tradeDate,
            },
          },
          update: {
            closePrice: item.closePrice,
            dailyReturn: item.dailyReturn,
          },
          create: item,
        });
        syncedCount++;
      }

      results.push({
        indexCode,
        indexName: getIndexName(indexCode),
        syncedDays: syncedCount,
        success: true,
      });
    } 
    else {
      return NextResponse.json(
        { error: '缺少 indexCode 或 syncAll 参数' },
        { status: 400 }
      );
    }

    const totalSynced = results.reduce((sum, r) => sum + r.syncedDays, 0);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `同步完成: 成功 ${successCount} 个，失败 ${failCount} 个，共 ${totalSynced} 条数据`,
      results,
      totalSynced,
      successCount,
      failCount,
    });
  } catch (error: any) {
    console.error('[Index Sync] 同步失败:', error);
    return NextResponse.json(
      { error: '同步指数数据失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 获取策略-指数映射关系
 */
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secondaryStrategy = searchParams.get('secondaryStrategy');

    if (!secondaryStrategy) {
      return NextResponse.json(
        { error: '缺少二级策略参数' },
        { status: 400 }
      );
    }

    const mapping = await prisma.indexMapping.findUnique({
      where: { secondaryStrategy },
    });

    return NextResponse.json({ mapping });
  } catch (error: any) {
    console.error('获取策略-指数映射失败:', error);
    return NextResponse.json(
      { error: '获取策略-指数映射失败', details: error.message },
      { status: 500 }
    );
  }
}
