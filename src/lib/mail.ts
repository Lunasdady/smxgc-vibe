import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.163.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || 'smxgc_nav_sever@163.com',
    pass: process.env.SMTP_PASS || '',
  },
});

export async function sendVerificationEmail(to: string, code: string, type: 'register' | 'forgot-password') {
  const subject = type === 'register' ? '私募星工厂 - 注册验证码' : '私募星工厂 - 密码重置验证码';
  const text = type === 'register'
    ? `您好，欢迎注册私募星工厂！\n\n您的验证码是：${code}\n\n验证码5分钟内有效，请勿泄露给他人。\n\n如非本人操作，请忽略此邮件。`
    : `您好！\n\n您正在重置私募星工厂账户密码。\n\n您的验证码是：${code}\n\n验证码5分钟内有效，请勿泄露给他人。\n\n如非本人操作，请忽略此邮件。`;

  const html = type === 'register'
    ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f5f5f7; border-radius: 16px;">
      <h2 style="color: #1d1d1f; margin-bottom: 16px; font-size: 20px;">欢迎注册私募星工厂</h2>
      <p style="color: #86868b; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">您好，感谢您对私募星工厂的关注。请使用以下验证码完成注册：</p>
      <div style="background: #fff; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 700; color: #0071e3; letter-spacing: 8px;">${code}</span>
      </div>
      <p style="color: #86868b; font-size: 13px; line-height: 1.6;">验证码5分钟内有效，请勿泄露给他人。<br>如非本人操作，请忽略此邮件。</p>
    </div>`
    : `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f5f5f7; border-radius: 16px;">
      <h2 style="color: #1d1d1f; margin-bottom: 16px; font-size: 20px;">密码重置</h2>
      <p style="color: #86868b; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">您正在重置私募星工厂账户密码。请使用以下验证码：</p>
      <div style="background: #fff; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 700; color: #0071e3; letter-spacing: 8px;">${code}</span>
      </div>
      <p style="color: #86868b; font-size: 13px; line-height: 1.6;">验证码5分钟内有效，请勿泄露给他人。<br>如非本人操作，请忽略此邮件。</p>
    </div>`;

  await transporter.sendMail({
    from: `"私募星工厂" <${process.env.SMTP_USER || 'smxgc_nav_sever@163.com'}>`,
    to,
    subject,
    text,
    html,
  });
}
