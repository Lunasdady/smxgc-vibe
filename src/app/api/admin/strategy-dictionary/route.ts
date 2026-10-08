import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * 获取策略字典列表
 */
export async function GET() {
  try {
    const strategies = await prisma.strategyDictionary.findMany({
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
      ],
    });

    return NextResponse.json({ strategies });
  } catch (error: any) {
    console.error('获取策略字典失败:', error);
    return NextResponse.json(
      { error: '获取策略字典失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 添加或更新策略字典
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, level, parentStrategy, strategyName, sortOrder } = body;

    if (!strategyName) {
      return NextResponse.json(
        { error: '策略名称不能为空' },
        { status: 400 }
      );
    }

    if (id) {
      // 更新
      const strategy = await prisma.strategyDictionary.update({
        where: { id },
        data: {
          level,
          parentStrategy: parentStrategy || null,
          strategyName,
          sortOrder: sortOrder || 0,
        },
      });

      return NextResponse.json({ strategy, message: '更新成功' });
    } else {
      // 添加
      const strategy = await prisma.strategyDictionary.create({
        data: {
          level,
          parentStrategy: parentStrategy || null,
          strategyName,
          sortOrder: sortOrder || 0,
        },
      });

      return NextResponse.json({ strategy, message: '添加成功' });
    }
  } catch (error: any) {
    console.error('保存策略字典失败:', error);
    return NextResponse.json(
      { error: '保存策略字典失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 更新策略状态
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    const strategy = await prisma.strategyDictionary.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ strategy });
  } catch (error: any) {
    console.error('更新策略状态失败:', error);
    return NextResponse.json(
      { error: '更新失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 删除策略字典
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json(
        { error: '缺少ID参数' },
        { status: 400 }
      );
    }

    await prisma.strategyDictionary.delete({
      where: { id },
    });

    return NextResponse.json({ message: '删除成功' });
  } catch (error: any) {
    console.error('删除策略字典失败:', error);
    return NextResponse.json(
      { error: '删除失败', details: error.message },
      { status: 500 }
    );
  }
}
