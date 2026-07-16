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

    // 查询登录用户的访问次数
    const userAccessStats = await prisma.accessLog.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        userId: true,
      },
      orderBy: {
        _count: {
          userId: 'desc',
        },
      },
      take: 10,
    });

    // 获取用户详细信息(排除被拒绝的用户)
    const data = [];
    for (const stat of userAccessStats) {
      const user = await prisma.user.findUnique({
        where: { 
          id: stat.userId!,
          status: {
            not: 'rejected',
          },
        },
        select: {
          realName: true,
          email: true,
          organization: true,
        },
      });

      if (user) {
        // 获取最近访问时间
        const latestLog = await prisma.accessLog.findFirst({
          where: {
            userId: stat.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        });

        data.push({
          userId: stat.userId,
          realName: user.realName,
          email: user.email,
          organization: user.organization,
          visitCount: stat._count.userId,
          lastVisit: latestLog ? dayjs(latestLog.createdAt).format('YYYY-MM-DD HH:mm') : '-',
        });
      }
    }

    return NextResponse.json({ days: validDays, data });
  } catch (error) {
    console.error('User rank error:', error);
    return NextResponse.json({ error: 'Failed to fetch user rank' }, { status: 500 });
  }
}
