import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const productCode = searchParams.get('productCode');
    const productName = searchParams.get('productName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source');
    
    const where: any = {};
    
    if (productCode) {
      where.productCode = { contains: productCode };
    }
    
    if (productName) {
      where.productName = { contains: productName };
    }
    
    if (startDate || endDate) {
      where.navDate = {};
      if (startDate) {
        where.navDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.navDate.lte = new Date(endDate);
      }
    }
    
    if (source) {
      where.source = source;
    }
    
    const [navData, total] = await Promise.all([
      prisma.navData.findMany({
        where,
        orderBy: { navDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.navData.count({ where }),
    ]);
    
    return NextResponse.json({
      navData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching nav data:', error);
    return NextResponse.json(
      { error: '获取净值数据失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids, productCode, startDate, endDate } = body;
    
    let deleteCount = 0;
    
    // 方式1: 按ID删除(支持单个或批量)
    if (ids && ids.length > 0) {
      const result = await prisma.navData.deleteMany({
        where: {
          id: {
            in: ids.map((id: string) => parseInt(id)),
          },
        },
      });
      deleteCount = result.count;
    }
    // 方式2: 按条件删除(产品代码+日期范围)
    else if (productCode || (startDate || endDate)) {
      const where: any = {};
      
      if (productCode) {
        where.productCode = productCode;
      }
      
      if (startDate || endDate) {
        where.navDate = {};
        if (startDate) {
          where.navDate.gte = new Date(startDate);
        }
        if (endDate) {
          where.navDate.lte = new Date(endDate);
        }
      }
      
      const result = await prisma.navData.deleteMany({
        where,
      });
      deleteCount = result.count;
    }
    // 方式3: 删除全部(需要明确确认)
    else if (body.deleteAll === true) {
      const result = await prisma.navData.deleteMany({});
      deleteCount = result.count;
    } else {
      return NextResponse.json(
        { error: '请指定删除条件: ids、productCode+日期范围、或deleteAll' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `成功删除 ${deleteCount} 条净值数据`,
      deleteCount,
    });
  } catch (error: any) {
    console.error('Error deleting nav data:', error);
    return NextResponse.json(
      { error: '删除净值数据失败', details: error.message },
      { status: 500 }
    );
  }
}
