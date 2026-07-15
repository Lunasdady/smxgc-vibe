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

    // 查询日期范围内的所有访问日志
    const logs = await prisma.accessLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        ip: true,
        userId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 按日期聚合
    const trendMap = new Map<string, { pv: number; uv: number; loginUV: number }>();
    for (let i = 0; i < validDays; i++) {
      const date = dayjs().subtract(validDays - 1 - i, 'day').format('YYYY-MM-DD');
      trendMap.set(date, { pv: 0, uv: 0, loginUV: 0 });
    }

    for (const log of logs) {
      const date = dayjs(log.createdAt).format('YYYY-MM-DD');
      const entry = trendMap.get(date);
      if (entry) {
        entry.pv += 1;
      }
    }

    // 计算每日 UV（去重 IP）和登录 UV（去重 userId）
    for (let i = 0; i < validDays; i++) {
      const date = dayjs().subtract(validDays - 1 - i, 'day').format('YYYY-MM-DD');
      const dayStart = dayjs().subtract(validDays - 1 - i, 'day').startOf('day').toDate();
      const dayEnd = dayjs().subtract(validDays - 1 - i, 'day').endOf('day').toDate();

      const dayLogs = await prisma.accessLog.findMany({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        select: {
          ip: true,
          userId: true,
        },
      });

      const uniqueIps = new Set(dayLogs.map((l) => l.ip).filter(Boolean));
      const uniqueUsers = new Set(dayLogs.map((l) => l.userId).filter(Boolean));

      const entry = trendMap.get(date);
      if (entry) {
        entry.uv = uniqueIps.size;
        entry.loginUV = uniqueUsers.size;
      }
    }

    const data = Array.from(trendMap.entries()).map(([date, stats]) => ({
      date,
      pv: stats.pv,
      uv: stats.uv,
      loginUV: stats.loginUV,
    }));

    return NextResponse.json({ days: validDays, data });
  } catch (error) {
    console.error('Visit trend error:', error);
    return NextResponse.json({ error: 'Failed to fetch visit trend' }, { status: 500 });
  }
}
