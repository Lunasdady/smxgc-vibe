import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import dayjs from 'dayjs';

// 强制动态渲染，不使用静态缓存
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 获取所有不重复的数据日期
    const dates = await prisma.fundProduct.groupBy({
      by: ['dataDate'],
      orderBy: {
        dataDate: 'desc',
      },
    });

    // 转换为字符串数组
    const dateStrings = dates.map((d: { dataDate: Date }) => dayjs(d.dataDate).format('YYYY-MM-DD'));

    return NextResponse.json({ dates: dateStrings });
  } catch (error) {
    console.error('Error fetching dates:', error);
    return NextResponse.json({ error: 'Failed to fetch dates' }, { status: 500 });
  }
}