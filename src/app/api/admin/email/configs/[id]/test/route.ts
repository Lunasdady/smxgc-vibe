import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { testImapConnection } from '@/lib/email-parser/imap-client';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const configId = parseInt(params.id);
    
    // 获取邮箱配置
    const config = await prisma.emailConfig.findUnique({
      where: { id: configId },
    });
    
    if (!config) {
      return NextResponse.json(
        { error: '邮箱配置不存在' },
        { status: 404 }
      );
    }
    
    // 测试连接
    const startTime = Date.now();
    try {
      const success = await testImapConnection({
        user: config.email,
        host: config.imapHost,
        port: config.imapPort,
        password: config.passwordEncrypted,
        ssl: config.sslEnabled,
      });
      
      const responseTime = Date.now() - startTime;
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: '连接成功',
          responseTime: `${responseTime}ms`,
        });
      } else {
        return NextResponse.json(
          { error: '连接失败' },
          { status: 500 }
        );
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return NextResponse.json(
        {
          error: '连接失败',
          message: error.message || '未知错误',
          responseTime: `${responseTime}ms`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error testing email connection:', error);
    return NextResponse.json(
      { error: '测试连接失败' },
      { status: 500 }
    );
  }
}
