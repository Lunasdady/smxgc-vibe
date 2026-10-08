import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import dayjs from 'dayjs';

// 强制动态渲染，不使用静态缓存
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 查询FundProduct表中最新的数据日期（用于概览页箱型图）
    const result: any[] = await prisma.$queryRaw`
      SELECT DISTINCT dataDate 
      FROM FundProduct 
      WHERE dataDate IS NOT NULL 
      ORDER BY dataDate DESC 
      LIMIT 1
    `;

    if (result && result.length > 0 && result[0].dataDate) {
      const dateValue = new Date(result[0].dataDate);
      const formattedDate = dayjs(dateValue).format('YYYY-MM-DD');
      console.log(`[Latest Date API] FundProduct最新日期: ${formattedDate}`);
      return NextResponse.json({ date: formattedDate });
    }

    // 如果FundProduct没有数据，回退到NavData的最新周五
    const navResult: any[] = await prisma.$queryRaw`
      SELECT DISTINCT navDate 
      FROM NavData 
      WHERE navDate IS NOT NULL 
      ORDER BY navDate DESC 
      LIMIT 1000
    `;

    for (const row of navResult) {
      const dateValue = new Date(row.navDate);
      if (dateValue.getDay() === 5) {
        const formattedDate = dayjs(dateValue).format('YYYY-MM-DD');
        console.log(`[Latest Date API] NavData最新周五: ${formattedDate}`);
        return NextResponse.json({ date: formattedDate });
      }
    }

    console.log('[Latest Date API] 无数据');
    return NextResponse.json({ date: null });
  } catch (error) {
    console.error('Error fetching latest date:', error);
    return NextResponse.json({ error: 'Failed to fetch latest date' }, { status: 500 });
  }
}