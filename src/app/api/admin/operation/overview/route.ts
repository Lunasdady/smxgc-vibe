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

    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().endOf('day').toDate();

    // 总注册用户数
    const totalUsers = await prisma.user.count();

    // 今日新增注册
    const todayNewUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 今日 PV（总访问次数）
    const todayPV = await prisma.accessLog.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 今日 UV（去重 IP）
    const todayUVRecords = await prisma.accessLog.groupBy({
      by: ['ip'],
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
    const todayUV = todayUVRecords.length;

    // 今日登录用户访问数（去重 userId）
    const todayLoginUsers = await prisma.accessLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        userId: { not: null },
      },
    });
    const todayLoginUV = todayLoginUsers.length;

    // 待审核用户数
    const pendingUsers = await prisma.user.count({
      where: { status: 'pending' },
    });

    // 已授权用户数
    const approvedUsers = await prisma.user.count({
      where: { status: 'approved' },
    });

    return NextResponse.json({
      totalUsers,
      todayNewUsers,
      todayPV,
      todayUV,
      todayLoginUV,
      pendingUsers,
      approvedUsers,
    });
  } catch (error) {
    console.error('Operation overview error:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
