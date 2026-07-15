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

    // 按页面统计 PV 和 UV
    const pageStats = await prisma.accessLog.groupBy({
      by: ['page'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        page: true,
      },
    });

    // 为每个页面计算 UV（去重 IP）
    const data = [];
    for (const stat of pageStats) {
      const uvRecords = await prisma.accessLog.groupBy({
        by: ['ip'],
        where: {
          page: stat.page,
          createdAt: {
            gte: startDate,
          },
        },
        _count: true,
      });

      data.push({
        page: stat.page,
        pv: stat._count.page,
        uv: uvRecords.length,
      });
    }

    // 按 PV 排序，取 Top 10
    data.sort((a, b) => b.pv - a.pv);

    return NextResponse.json({ days: validDays, data: data.slice(0, 10) });
  } catch (error) {
    console.error('Page rank error:', error);
    return NextResponse.json({ error: 'Failed to fetch page rank' }, { status: 500 });
  }
}
