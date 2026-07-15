import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    if (decoded.role !== 'admin') return null;
    return decoded;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const admin = verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const validDays = [7, 30, 90].includes(days) ? days : 30;

    const startDate = dayjs().subtract(validDays - 1, 'day').startOf('day').toDate();
    const endDate = dayjs().endOf('day').toDate();

    // 查询日期范围内的所有新注册用户
    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 按日期聚合
    const trendMap = new Map<string, number>();
    for (let i = 0; i < validDays; i++) {
      const date = dayjs().subtract(validDays - 1 - i, 'day').format('YYYY-MM-DD');
      trendMap.set(date, 0);
    }

    for (const user of users) {
      const date = dayjs(user.createdAt).format('YYYY-MM-DD');
      if (trendMap.has(date)) {
        trendMap.set(date, (trendMap.get(date) || 0) + 1);
      }
    }

    const data = Array.from(trendMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json({ days: validDays, data });
  } catch (error) {
    console.error('User trend error:', error);
    return NextResponse.json({ error: 'Failed to fetch user trend' }, { status: 500 });
  }
}
