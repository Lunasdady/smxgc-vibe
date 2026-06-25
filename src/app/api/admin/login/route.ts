import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (password === process.env.ADMIN_PASSWORD) {
      // 生成 JWT token
      const token = jwt.sign({ role: 'admin' }, SECRET_KEY, {
        expiresIn: '24h',
      });

      return NextResponse.json({ token });
    } else {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}