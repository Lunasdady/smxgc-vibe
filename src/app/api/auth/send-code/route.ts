import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendVerificationEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const { email, type } = await request.json();

    if (!email || !type || !['register', 'forgot-password'].includes(type)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // 如果是注册，检查邮箱是否已存在
    if (type === 'register') {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
    }

    // 如果是找回密码，检查邮箱是否存在
    if (type === 'forgot-password') {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        return NextResponse.json({ error: 'Email not found' }, { status: 404 });
      }
    }

    // 生成验证码，5分钟有效
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 保存到数据库
    await prisma.verificationCode.create({
      data: { email, code, type, expiresAt },
    });

    // 发送邮件
    await sendVerificationEmail(email, code, type);

    return NextResponse.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('Send code error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
