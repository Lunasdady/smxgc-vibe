import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import dayjs from 'dayjs';

export async function GET() {
  try {
    // 获取最新的数据日期
    const latest = await prisma.fundProduct.findFirst({
      orderBy: {
        dataDate: 'desc',
      },
      select: {
        dataDate: true,
      },
    });

    if (latest) {
      return NextResponse.json({ date: dayjs(latest.dataDate).format('YYYY-MM-DD') });
    } else {
      return NextResponse.json({ date: null });
    }
  } catch (error) {
    console.error('Error fetching latest date:', error);
    return NextResponse.json({ error: 'Failed to fetch latest date' }, { status: 500 });
  }
}