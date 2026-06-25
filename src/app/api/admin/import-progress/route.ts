import { NextResponse } from 'next/server';

// 导入进度存储（需要与import/route.ts共享）
// 由于模块隔离，我们需要从import模块导出Map
let importProgressMap: Map<string, any>;

// 动态导入以获取进度Map
async function getImportProgressMap() {
  if (!importProgressMap) {
    const importModule = await import('../import/route');
    // 从import模块获取Map（我们需要修改import/route.ts导出Map）
    // 暂时使用全局变量
    importProgressMap = (globalThis as any).__importProgressMap || new Map();
  }
  return importProgressMap;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');

    if (!importId) {
      return NextResponse.json(
        { error: '请提供importId参数' },
        { status: 400 }
      );
    }

    // 使用全局变量访问进度Map
    const progressMap = (globalThis as any).__importProgressMap;
    if (!progressMap) {
      return NextResponse.json(
        { error: '进度追踪未初始化' },
        { status: 500 }
      );
    }

    const progress = progressMap.get(importId);

    if (!progress) {
      return NextResponse.json(
        { error: '未找到该导入任务' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      importId,
      progress: progress.progress,
      total: progress.total,
      current: progress.current,
      status: progress.status,
      message: progress.message,
      result: progress.result,
    });
  } catch (error) {
    console.error('Error fetching import progress:', error);
    return NextResponse.json(
      { error: '获取进度失败' },
      { status: 500 }
    );
  }
}
