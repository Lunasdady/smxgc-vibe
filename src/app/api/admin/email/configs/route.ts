import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/email-parser/crypto';
import { ensureEmailParserInitialized } from '@/lib/email-parser/init';

export async function GET() {
  // 确保邮件解析系统已初始化（只执行一次）
  await ensureEmailParserInitialized();
  
  try {
    const configs = await prisma.emailConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    // 不返回加密后的密码
    const safeConfigs = configs.map(({ passwordEncrypted, ...rest }) => rest);
    
    return NextResponse.json(safeConfigs);
  } catch (error) {
    console.error('Error fetching email configs:', error);
    return NextResponse.json(
      { error: '获取邮箱配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, imapHost, imapPort, password, sslEnabled, enabled } = body;
    
    if (!email || !imapHost || !password) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }
    
    // 加密密码
    const encryptedPassword = encrypt(password);
    
    const config = await prisma.emailConfig.create({
      data: {
        email,
        imapHost,
        imapPort: parseInt(imapPort) || 993,
        passwordEncrypted: encryptedPassword,
        sslEnabled: sslEnabled !== false,
        enabled: enabled !== false,
      },
    });
    
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error creating email config:', error);
    return NextResponse.json(
      { error: '创建邮箱配置失败' },
      { status: 500 }
    );
  }
}
