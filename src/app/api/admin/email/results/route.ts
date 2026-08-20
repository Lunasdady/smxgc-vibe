import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// 获取解析结果统计
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 检查是否是统计请求
    if (searchParams.get('action') === 'statistics') {
      return await getStatistics();
    }
    
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const parseStatus = searchParams.get('parseStatus');
    const emailConfigId = searchParams.get('emailConfigId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const where: any = {};
    
    if (parseStatus) {
      where.parseStatus = parseStatus;
    }
    
    if (emailConfigId) {
      where.emailConfigId = parseInt(emailConfigId);
    }
    
    if (startDate || endDate) {
      where.receivedAt = {};
      if (startDate) {
        where.receivedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.receivedAt.lte = new Date(endDate);
      }
    }
    
    // 🚨 修复：先获取所有匹配的记录，再统计DISTINCT emailUid
    const results = await prisma.emailParseResult.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        emailConfig: {
          select: {
            email: true,
          },
        },
      },
    });
    
    // 🚨 使用原始SQL统计DISTINCT emailUid
    let whereClause = '';
    const params: any[] = [];
    
    if (parseStatus) {
      whereClause += ` WHERE "parseStatus" = $${params.length + 1}`;
      params.push(parseStatus);
    }
    
    if (emailConfigId) {
      whereClause += whereClause ? ` AND "emailConfigId" = $${params.length + 1}` : ` WHERE "emailConfigId" = $${params.length + 1}`;
      params.push(parseInt(emailConfigId));
    }
    
    if (startDate || endDate) {
      if (startDate && endDate) {
        whereClause += whereClause ? ` AND "receivedAt" BETWEEN $${params.length + 1} AND $${params.length + 2}` : ` WHERE "receivedAt" BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(new Date(startDate), new Date(endDate));
      } else if (startDate) {
        whereClause += whereClause ? ` AND "receivedAt" >= $${params.length + 1}` : ` WHERE "receivedAt" >= $${params.length + 1}`;
        params.push(new Date(startDate));
      } else if (endDate) {
        whereClause += whereClause ? ` AND "receivedAt" <= $${params.length + 1}` : ` WHERE "receivedAt" <= $${params.length + 1}`;
        params.push(new Date(endDate));
      }
    }
    
    const uniqueCountResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT "emailUid") as count FROM EmailParseResult${whereClause}`,
      ...params
    );
    const total = Number((uniqueCountResult as any)[0].count);
    
    return NextResponse.json({
      results,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching parse results:', error);
    return NextResponse.json(
      { error: '获取解析结果失败' },
      { status: 500 }
    );
  }
}

// 统计API实现
async function getStatistics() {
  try {
    // 🚨 修复：使用DISTINCT emailUid统计唯一邮件数，避免重复计算
    const uniqueStats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT "emailUid") as total,
        COUNT(DISTINCT CASE WHEN "parseStatus" = 'success' THEN "emailUid" END) as success,
        COUNT(DISTINCT CASE WHEN "parseStatus" = 'failed' THEN "emailUid" END) as failed,
        COUNT(DISTINCT CASE WHEN "parseStatus" = 'skipped' THEN "emailUid" END) as skipped
      FROM EmailParseResult
    `;
    
    const totalCount = Number((uniqueStats as any)[0].total);
    const successCount = Number((uniqueStats as any)[0].success);
    const failedCount = Number((uniqueStats as any)[0].failed);
    const skippedCount = Number((uniqueStats as any)[0].skipped);
    
    // 计算百分比
    const totalPercent = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(2) : '0.00';
    const failedPercent = totalCount > 0 ? ((failedCount / totalCount) * 100).toFixed(2) : '0.00';
    const skippedPercent = totalCount > 0 ? ((skippedCount / totalCount) * 100).toFixed(2) : '0.00';
    
    // 🚨 修复：获取失败原因时也使用DISTINCT emailUid
    const allFailed = await prisma.$queryRaw`
      SELECT DISTINCT "emailUid", "errorReason"
      FROM EmailParseResult
      WHERE "parseStatus" = 'failed' AND "errorReason" IS NOT NULL AND "errorReason" != ''
    `;
    
    // 过滤空字符串并统计失败原因
    const reasonMap: Record<string, number> = {};
    (allFailed as any[]).forEach((r: any) => {
      if (r.error_reason && r.error_reason.trim()) {
        reasonMap[r.error_reason] = (reasonMap[r.error_reason] || 0) + 1;
      }
    });
    
    // 转换为数组并排序
    const topFailureReasons = Object.entries(reasonMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return NextResponse.json({
      totalCount,
      successCount,
      failedCount,
      skippedCount,
      totalPercent: parseFloat(totalPercent),
      failedPercent: parseFloat(failedPercent),
      skippedPercent: parseFloat(skippedPercent),
      topFailureReasons,
    });
  } catch (error: any) {
    console.error('Error getting statistics:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids, parseStatus, emailConfigId, startDate, endDate } = body;
    
    let deleteCount = 0;
    
    // 方式1: 按ID删除(支持单个或批量)
    if (ids && ids.length > 0) {
      const result = await prisma.emailParseResult.deleteMany({
        where: {
          id: {
            in: ids.map((id: string) => parseInt(id)),
          },
        },
      });
      deleteCount = result.count;
    }
    // 方式2: 按条件删除
    else if (parseStatus || emailConfigId || startDate || endDate) {
      const where: any = {};
      
      if (parseStatus) {
        where.parseStatus = parseStatus;
      }
      
      if (emailConfigId) {
        where.emailConfigId = parseInt(emailConfigId);
      }
      
      if (startDate || endDate) {
        where.receivedAt = {};
        if (startDate) {
          where.receivedAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.receivedAt.lte = new Date(endDate);
        }
      }
      
      const result = await prisma.emailParseResult.deleteMany({
        where,
      });
      deleteCount = result.count;
    }
    // 方式3: 删除全部
    else if (body.deleteAll === true) {
      const result = await prisma.emailParseResult.deleteMany({});
      deleteCount = result.count;
    } else {
      return NextResponse.json(
        { error: '请指定删除条件: ids、筛选条件、或deleteAll' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `成功删除 ${deleteCount} 条解析结果`,
      deleteCount,
    });
  } catch (error: any) {
    console.error('Error deleting parse results:', error);
    return NextResponse.json(
      { error: '删除解析结果失败', details: error.message },
      { status: 500 }
    );
  }
}
