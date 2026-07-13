import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8 || newPassword.length > 20) {
      return NextResponse.json({ error: 'Password must be 8-20 characters' }, { status: 400 });
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return NextResponse.json({ error: 'Password must contain both letters and numbers' }, { status: 400 });
    }

    // 验证验证码
    const record = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type: 'forgot-password',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
