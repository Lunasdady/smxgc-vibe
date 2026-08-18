import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json(
        { error: '缺少taskId参数' },
        { status: 400 }
      );
    }
    
    const task = await prisma.parseTask.findUnique({
      where: { id: taskId },
    });
    
    if (!task) {
      return NextResponse.json(
        { error: '未找到该任务' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      taskId: task.id,
      progress: task.progress,
      total: task.total,
      current: task.current,
      status: task.status,
      message: task.message,
    });
  } catch (error: any) {
    console.error('Error fetching parse progress:', error);
    return NextResponse.json(
      { error: '获取进度失败' },
      { status: 500 }
    );
  }
}
