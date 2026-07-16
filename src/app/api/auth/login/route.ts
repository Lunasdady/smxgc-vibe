import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

export async function POST(request: Request) {
  try {
    const { account, password } = await request.json();

    if (!account || !password) {
      return NextResponse.json({ error: 'Missing account or password' }, { status: 400 });
    }

    // 支持邮箱或手机号登录
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: account }, { phone: account }],
      },
    });

    if (!user || user.status === 'rejected') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // 生成JWT Token，7天有效期
    const token = jwt.sign(
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
      token,
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
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
