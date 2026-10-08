import { NextResponse } from 'next/server';
import { createTransporter } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFromName, smtpSecure } = body;

    // 验证必填字段
    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: '发件邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 创建临时传输器测试连接
    const transporter = await createTransporter({
      host: smtpHost || 'smtp.163.com',
      port: parseInt(smtpPort) || 465,
      user: smtpUser,
      pass: smtpPass,
      fromName: smtpFromName || '私募星工厂',
      secure: smtpSecure !== false,
    });

    // 获取发件人地址
    const fromAddress = `"${smtpFromName || '私募星工厂'}" <${smtpUser}>`;

    // 发送测试邮件到配置的邮箱
    await transporter.sendMail({
      from: fromAddress,
      to: smtpUser,
      subject: 'SMTP配置测试邮件',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f7;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1d1d1f; margin-bottom: 16px;">✅ SMTP配置测试成功</h2>
            <p style="color: #86868b; line-height: 1.6;">
              恭喜！您的SMTP邮箱配置已成功保存。系统现在可以使用此配置发送注册验证码邮件。
            </p>
            <div style="margin-top: 24px; padding: 16px; background: #f5f5f7; border-radius: 8px;">
              <p style="margin: 0; color: #1d1d1f; font-size: 14px;">
                <strong>配置信息：</strong><br/>
                SMTP服务器：${smtpHost || 'smtp.163.com'}<br/>
                端口：${smtpPort || 465}<br/>
                发件邮箱：${smtpUser}<br/>
                SSL加密：${smtpSecure !== false ? '已启用' : '未启用'}
              </p>
            </div>
            <p style="margin-top: 24px; color: #86868b; font-size: 13px;">
              此邮件由系统自动发送，用于测试SMTP配置。
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: '测试邮件已发送，请检查收件箱',
    });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: error.message || '邮件发送失败' },
      { status: 500 }
    );
  }
}
