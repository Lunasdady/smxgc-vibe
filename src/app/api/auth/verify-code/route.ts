import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, code, type } = await request.json();

    if (!email || !code || !type) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const record = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Code verified' });
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
