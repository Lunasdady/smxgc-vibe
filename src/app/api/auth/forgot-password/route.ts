import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendVerificationEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.verificationCode.create({
      data: { email, code, type: 'forgot-password', expiresAt },
    });

    await sendVerificationEmail(email, code, 'forgot-password');

    return NextResponse.json({ success: true, message: 'Reset code sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to send reset code' }, { status: 500 });
  }
}
