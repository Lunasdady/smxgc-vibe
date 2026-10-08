import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import dayjs from 'dayjs';

// 强制动态渲染，不使用静态缓存
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 查询FundProduct表中所有不重复的数据日期（概览页箱型图用）
    const dates: any[] = await prisma.$queryRaw`
      SELECT DISTINCT dataDate 
      FROM FundProduct 
      WHERE dataDate IS NOT NULL
      ORDER BY dataDate DESC
    `;

    // 转换为字符串数组
    const dateStrings = dates
      .filter((d: any) => d.dataDate !== null)
      .map((d: any) => {
        const dateValue = new Date(d.dataDate);
        return dayjs(dateValue).format('YYYY-MM-DD');
      });

    console.log(`[Dates API] FundProduct可用日期数: ${dateStrings.length}`);
    return NextResponse.json({ dates: dateStrings });
  } catch (error) {
    console.error('Error fetching dates:', error);
    return NextResponse.json({ error: 'Failed to fetch dates' }, { status: 500 });
  }
}