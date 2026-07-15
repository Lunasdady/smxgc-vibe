import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

export async function POST(request: Request) {
  try {
    const { page } = await request.json();

    if (!page || typeof page !== 'string') {
      return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }

    // 从 cookie 中尝试获取 userId
    let userId: number | null = null;
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const tokenMatch = cookieHeader.match(/user-token=([^;]+)/);
      if (tokenMatch) {
        try {
          const decoded = jwt.verify(tokenMatch[1], SECRET_KEY) as any;
          if (decoded.userId) {
            userId = decoded.userId;
          }
        } catch {
          // token 无效，忽略
        }
      }
    }

    // 获取 IP 和 User-Agent
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    // 写入访问日志
    await prisma.accessLog.create({
      data: {
        userId,
        page,
        ip: typeof ip === 'string' ? ip.split(',')[0].trim() : String(ip),
        userAgent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Access log error:', error);
    return NextResponse.json({ error: 'Failed to log access' }, { status: 500 });
  }
}
