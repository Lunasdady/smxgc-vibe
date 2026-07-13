import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, phone, realName, organization, password } = await request.json();

    if (!email || !realName || !organization || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 密码校验
    if (password.length < 8 || password.length > 20) {
      return NextResponse.json({ error: 'Password must be 8-20 characters' }, { status: 400 });
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      return NextResponse.json({ error: 'Password must contain both letters and numbers' }, { status: 400 });
    }

    // 检查邮箱是否已注册
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        phone: phone || null,
        realName,
        organization,
        password: hashedPassword,
        permissions: '[]',
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Registration successful, please wait for admin approval',
      user: {
        id: user.id,
        email: user.email,
        realName: user.realName,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
