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

    const now = dayjs();
    const sevenDaysAgo = now.subtract(7, 'day').toDate();
    const thirtyDaysAgo = now.subtract(30, 'day').toDate();

    // 活跃用户（近7天有访问的登录用户）
    const activeUsers = await prisma.accessLog.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // 沉睡用户（7-30天内有访问）
    const sleepyUsers = await prisma.accessLog.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: {
          gte: thirtyDaysAgo,
          lt: sevenDaysAgo,
        },
      },
    });
    // 排除活跃用户
    const activeUserIds = new Set(activeUsers.map((u) => u.userId));
    const sleepyUserCount = sleepyUsers.filter((u) => !activeUserIds.has(u.userId)).length;

    // 流失用户（30天以上无访问，但至少访问过一次）
    const allTimeUsers = await prisma.accessLog.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
      },
    });
    const allRecentUsers = await prisma.accessLog.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    const recentUserIds = new Set(allRecentUsers.map((u) => u.userId));
    const lostUserCount = allTimeUsers.filter((u) => !recentUserIds.has(u.userId)).length;

    // 从未访问的注册用户
    const totalLoginUsers = await prisma.user.count({
      where: { status: 'approved' },
    });
    const everVisitedUsers = allTimeUsers.length;
    const neverVisited = totalLoginUsers - everVisitedUsers;

    return NextResponse.json({
      data: [
        { name: '活跃用户（近7天）', count: activeUsers.length, color: '#16A34A' },
        { name: '沉睡用户（7-30天）', count: sleepyUserCount, color: '#F59E0B' },
        { name: '流失用户（30天以上）', count: lostUserCount, color: '#86868B' },
        { name: '从未访问', count: Math.max(0, neverVisited), color: '#DC2626' },
      ],
    });
  } catch (error) {
    console.error('User active error:', error);
    return NextResponse.json({ error: 'Failed to fetch user active stats' }, { status: 500 });
  }
}
