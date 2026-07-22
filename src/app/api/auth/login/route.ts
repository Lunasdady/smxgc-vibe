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

    console.log('[Login] 尝试登录:', { account: account.substring(0, 10) + '...' });

    // 支持邮箱或手机号登录
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: account }, { phone: account }],
      },
    });

    if (!user || user.status === 'rejected') {
      console.log('[Login] 用户不存在或被拒绝:', { account: account.substring(0, 10) + '...' });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Login] 找到用户:', { userId: user.id, email: user.email, realName: user.realName });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log('[Login] 密码错误:', { userId: user.id });
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    console.log('[Login] 登录成功,生成Token:', { userId: user.id, email: user.email });

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
    console.error('[Login] 登录异常:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
