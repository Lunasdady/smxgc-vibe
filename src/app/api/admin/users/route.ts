import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

// 校验管理员身份
function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    if (decoded.role !== 'admin') return null;
    return decoded;
  } catch {
    return null;
  }
}

// 获取用户列表
export async function GET(request: Request) {
  try {
    const admin = verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { realName: { contains: search } },
        { organization: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        realName: true,
        organization: true,
        permissions: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        permissions: JSON.parse(u.permissions || '[]'),
      })),
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
  }
}

// 批量审核通过并分配权限
export async function POST(request: Request) {
  try {
    const admin = verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userIds, permissions } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Invalid userIds' }, { status: 400 });
    }

    // 更新用户权限和状态
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        status: 'approved',
        permissions: JSON.stringify(permissions || ['strategy-detail']),
      },
    });

    return NextResponse.json({ success: true, message: 'Users approved' });
  } catch (error) {
    console.error('Approve users error:', error);
    return NextResponse.json({ error: 'Failed to approve users' }, { status: 500 });
  }
}
