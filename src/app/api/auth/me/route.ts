import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SECRET_KEY) as any;

    console.log('[Auth/Me] Token解析成功:', { userId: decoded.userId, email: decoded.email });

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.status === 'rejected') {
      console.log('[Auth/Me] 用户不存在或被拒绝:', { userId: decoded.userId });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Auth/Me] 返回用户信息:', { userId: user.id, email: user.email, realName: user.realName });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      realName: user.realName,
      organization: user.organization,
      phone: user.phone,
      permissions: JSON.parse(user.permissions || '[]'),
      status: user.status,
    });
  } catch (error) {
    console.error('[Auth/Me] Token验证失败:', error);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
