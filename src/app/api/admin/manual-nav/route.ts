import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * 获取手工维护的净值数据列表
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const productCode = searchParams.get('productCode') || '';
    const productName = searchParams.get('productName') || '';

    // 构建查询条件
    const where: any = {
      source: 'manual', // 只查询手工数据
    };

    if (productCode) {
      where.productCode = { contains: productCode };
    }

    if (productName) {
      where.productName = { contains: productName };
    }

    // 查询总数
    const total = await prisma.navData.count({ where });

    // 查询数据
    const navData = await prisma.navData.findMany({
      where,
      orderBy: { navDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: navData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('获取手工净值数据失败:', error);
    return NextResponse.json(
      { error: '获取数据失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 添加手工净值数据
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productCode, productName, navDate, unitNav, cumulativeNav } = body;

    if (!productCode || !productName || !navDate || unitNav === undefined) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查是否已存在（同产品同日期）
    const existing = await prisma.navData.findUnique({
      where: {
        productCode_navDate: {
          productCode,
          navDate: new Date(navDate),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '该产品在该日期已有净值数据' },
        { status: 409 }
      );
    }

    // 创建新记录
    const navData = await prisma.navData.create({
      data: {
        productCode,
        productName,
        navDate: new Date(navDate),
        unitNav: parseFloat(unitNav),
        cumulativeNav: cumulativeNav ? parseFloat(cumulativeNav) : null,
        source: 'manual',
        confidence: 'high',
      },
    });

    return NextResponse.json({
      success: true,
      data: navData,
      message: '添加成功',
    });
  } catch (error: any) {
    console.error('添加手工净值数据失败:', error);
    return NextResponse.json(
      { error: '添加失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 更新手工净值数据
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, productCode, productName, navDate, unitNav, cumulativeNav } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少必要参数: id' },
        { status: 400 }
      );
    }

    // 检查是否存在
    const existing = await prisma.navData.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '记录不存在' },
        { status: 404 }
      );
    }

    if (existing.source !== 'manual') {
      return NextResponse.json(
        { error: '只能修改手工录入的数据' },
        { status: 403 }
      );
    }

    // 更新记录
    const navData = await prisma.navData.update({
      where: { id },
      data: {
        productCode: productCode || existing.productCode,
        productName: productName || existing.productName,
        navDate: navDate ? new Date(navDate) : existing.navDate,
        unitNav: unitNav !== undefined ? parseFloat(unitNav) : existing.unitNav,
        cumulativeNav: cumulativeNav !== undefined ? (cumulativeNav ? parseFloat(cumulativeNav) : null) : existing.cumulativeNav,
      },
    });

    return NextResponse.json({
      success: true,
      data: navData,
      message: '更新成功',
    });
  } catch (error: any) {
    console.error('更新手工净值数据失败:', error);
    return NextResponse.json(
      { error: '更新失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 删除手工净值数据
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json(
        { error: '缺少必要参数: id' },
        { status: 400 }
      );
    }

    // 检查是否存在
    const existing = await prisma.navData.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '记录不存在' },
        { status: 404 }
      );
    }

    if (existing.source !== 'manual') {
      return NextResponse.json(
        { error: '只能删除手工录入的数据' },
        { status: 403 }
      );
    }

    // 删除记录
    await prisma.navData.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error: any) {
    console.error('删除手工净值数据失败:', error);
    return NextResponse.json(
      { error: '删除失败', details: error.message },
      { status: 500 }
    );
  }
}
