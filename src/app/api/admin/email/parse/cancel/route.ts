import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// 存储取消信号(需要与parse/route.ts共享)
// 由于Node.js模块缓存,这里使用global来共享
const getCancelSignalMap = () => {
  if (!(global as any).cancelSignalMap) {
    (global as any).cancelSignalMap = new Map<string, boolean>();
  }
  return (global as any).cancelSignalMap;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: '缺少taskId参数' },
        { status: 400 }
      );
    }

    console.log('🛑 收到取消解析请求, taskId:', taskId);

    // 查找任务
    const task = await prisma.parseTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    if (task.status !== 'processing' && task.status !== 'pending') {
      return NextResponse.json(
        { error: `任务状态为${task.status},无法取消` },
        { status: 400 }
      );
    }

    // 设置取消信号
    const cancelSignalMap = getCancelSignalMap();
    cancelSignalMap.set(taskId, true);
    console.log('✅ 已设置取消信号:', taskId);

    // 更新任务状态
    await prisma.parseTask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        message: '用户手动取消解析',
      },
    });

    return NextResponse.json({
      success: true,
      message: '已取消解析任务',
    });
  } catch (error: any) {
    console.error('❌ 取消解析任务失败:', error);
    return NextResponse.json(
      { error: `取消失败: ${error.message}` },
      { status: 500 }
    );
  }
}

