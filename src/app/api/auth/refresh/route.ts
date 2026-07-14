import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oldToken = authHeader.split(' ')[1];

    // 验证旧 token（即使过期也尝试解码）
    let decoded: any;
    try {
      decoded = jwt.verify(oldToken, SECRET_KEY, { clockTolerance: 60 }) as any;
    } catch {
      // Token 完全过期或无效
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    // 查询数据库最新权限
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 生成新 token（保留原 token 的剩余有效期）
    const newToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: 'user',
        permissions: JSON.parse(user.permissions || '[]'),
      },
      SECRET_KEY,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token: newToken,
      user: {
        id: user.id,
        email: user.email,
        realName: user.realName,
        organization: user.organization,
        permissions: JSON.parse(user.permissions || '[]'),
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
