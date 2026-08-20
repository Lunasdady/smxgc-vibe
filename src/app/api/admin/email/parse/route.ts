import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { parseEmailConfig } from '@/lib/email-parser/engine';

// 存储取消信号(内存中,因为需要实时更新)
// 使用global确保多个路由文件可以共享
const getCancelSignalMap = () => {
  if (!(global as any).cancelSignalMap) {
    (global as any).cancelSignalMap = new Map<string, boolean>();
  }
  return (global as any).cancelSignalMap;
};

// 保持向后兼容的引用
const cancelSignalMap = getCancelSignalMap();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emailConfigId, fullParse, testLimit, testEarly, reparseFailed } = body;
    
    // 获取邮箱配置
    let configs;
    if (emailConfigId) {
      const config = await prisma.emailConfig.findUnique({
        where: { id: parseInt(emailConfigId) },
      });
      configs = config ? [config] : [];
    } else {
      // 解析所有启用的邮箱
      configs = await prisma.emailConfig.findMany({
        where: { enabled: true },
      });
    }
    
    if (configs.length === 0) {
      return NextResponse.json(
        { error: '没有可解析的邮箱配置' },
        { status: 400 }
      );
    }
    
    // 为每个邮箱创建解析任务
    const taskIds: string[] = [];
    for (const config of configs) {
      const taskId = `parse_${config.id}_${Date.now()}`;
      taskIds.push(taskId);
      
      // 🚨 根据模式设置任务描述
      let taskMessage = '等待解析...';
      if (reparseFailed) {
        taskMessage = '等待重新解析失败的邮件...';
      } else if (fullParse) {
        taskMessage = '等待全量解析...';
      } else if (testLimit) {
        taskMessage = `等待测试解析（${testLimit}封）...`;
      }
      
      // 保存到数据库
      await prisma.parseTask.create({
        data: {
          id: taskId,
          configId: config.id,
          progress: 0,
          total: 0,
          current: 0,
          status: 'pending',
          message: taskMessage,
          fullParse: !!fullParse,
          testLimit: testLimit || null,
        },
      });
            
      console.log('✅ 创建解析任务:', taskId, reparseFailed ? '(重新解析失败)' : '');
            
      // 异步执行解析
      executeParse(taskId, config.id, !!fullParse, testLimit, testEarly, !!reparseFailed);
    }
    
    // 🚨 生成友好的消息
    let message = `已启动 ${taskIds.length} 个解析任务`;
    if (reparseFailed) {
      message = `已启动 ${taskIds.length} 个重新解析任务（仅失败邮件）`;
    }
    
    return NextResponse.json({
      success: true,
      taskIds,
      message,
    });
  } catch (error) {
    console.error('Error starting parse task:', error);
    return NextResponse.json(
      { error: '启动解析任务失败' },
      { status: 500 }
    );
  }
}

/**
 * 执行解析任务
 */
async function executeParse(taskId: string, configId: number, fullParse: boolean = false, testLimit?: number, testEarly?: boolean, reparseFailed?: boolean) {
  try {
    // 更新状态为processing
    await prisma.parseTask.update({
      where: { id: taskId },
      data: {
        status: 'processing',
        message: '正在连接邮箱...',
      },
    });
    
    const result = await parseEmailConfig(configId, async (progress) => {
      // 检查是否已取消
      if (cancelSignalMap.get(taskId)) {
        console.log('🛑 任务已取消,停止解析:', taskId);
        await prisma.parseTask.update({
          where: { id: taskId },
          data: {
            status: 'cancelled',
            message: '已取消解析',
            progress: progress.progress,
            total: progress.total,
            current: progress.current,
          },
        });
        return; // 提前返回,停止更新
      }
      
      // 更新进度到数据库
      await prisma.parseTask.update({
        where: { id: taskId },
        data: {
          progress: progress.progress,
          total: progress.total,
          current: progress.current,
          message: progress.message,
        },
      });
    }, { fullParse, testLimit, testEarly, reparseFailed });
    
    // 再次检查是否已取消
    if (cancelSignalMap.get(taskId)) {
      console.log('🛑 任务已取消,不更新完成状态:', taskId);
      return;
    }
    
    // 更新完成状态
    await prisma.parseTask.update({
      where: { id: taskId },
      data: {
        progress: 100,
        total: result.total || 0,
        current: result.processed || 0,
        status: result.success ? 'completed' : 'failed',
        message: result.message || (result.success ? '解析完成' : '解析失败'),
        completedAt: new Date(),
      },
    });
  } catch (error: any) {
    // 如果是取消导致的错误,不标记为failed
    if (cancelSignalMap.get(taskId)) {
      console.log('🛑 任务已取消,不更新失败状态:', taskId);
      return;
    }
    
    await prisma.parseTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        message: error.message || '解析异常',
      },
    });
  } finally {
    // 清理取消信号
    cancelSignalMap.delete(taskId);
  }
}

/**
 * 取消解析任务（内部函数）
 */
async function cancelParseTask(taskId: string): Promise<boolean> {
  const task = await prisma.parseTask.findUnique({
    where: { id: taskId },
  });
  
  if (task && (task.status === 'processing' || task.status === 'pending')) {
    cancelSignalMap.set(taskId, true);
    console.log('🛑 设置取消信号:', taskId);
    return true;
  }
  return false;
}

// 获取所有进行中的任务
export async function GET() {
  try {
    const tasks = await prisma.parseTask.findMany({
      where: {
        status: {
          in: ['processing', 'pending'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching parse tasks:', error);
    return NextResponse.json(
      { error: '获取解析任务失败' },
      { status: 500 }
    );
  }
}
