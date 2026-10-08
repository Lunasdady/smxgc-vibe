import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const SMTP_KEYS = [
  'smtpHost',
  'smtpPort',
  'smtpUser',
  'smtpPass',
  'smtpFromName',
  'smtpSecure',
];

const DEFAULTS: Record<string, string> = {
  smtpHost: 'smtp.163.com',
  smtpPort: '465',
  smtpUser: '',
  smtpPass: '',
  smtpFromName: '私募星工厂',
  smtpSecure: 'true',
};

export async function GET() {
  try {
    const configs = await prisma.appConfig.findMany({
      where: { key: { in: SMTP_KEYS } },
    });

    const result: Record<string, string> = { ...DEFAULTS };
    for (const config of configs) {
      result[config.key] = config.value;
    }

    // 解密密码（如果已加密）
    let decryptedPass = result.smtpPass;
    if (result.smtpPass && isEncrypted(result.smtpPass)) {
      decryptedPass = decrypt(result.smtpPass);
    }

    return NextResponse.json({
      smtpHost: result.smtpHost,
      smtpPort: parseInt(result.smtpPort) || 465,
      smtpUser: result.smtpUser,
      smtpPass: decryptedPass,
      smtpFromName: result.smtpFromName,
      smtpSecure: result.smtpSecure === 'true',
    });
  } catch (error) {
    console.error('Error fetching SMTP config:', error);
    return NextResponse.json({
      smtpHost: DEFAULTS.smtpHost,
      smtpPort: parseInt(DEFAULTS.smtpPort),
      smtpUser: DEFAULTS.smtpUser,
      smtpPass: DEFAULTS.smtpPass,
      smtpFromName: DEFAULTS.smtpFromName,
      smtpSecure: DEFAULTS.smtpSecure === 'true',
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFromName, smtpSecure } = body;

    // 对密码加密存储（如果新传入的密码未加密）
    let passToStore = smtpPass || '';
    if (passToStore && !isEncrypted(passToStore)) {
      passToStore = encrypt(passToStore);
    }

    const updates = [
      { key: 'smtpHost', value: smtpHost || DEFAULTS.smtpHost },
      { key: 'smtpPort', value: String(smtpPort || DEFAULTS.smtpPort) },
      { key: 'smtpUser', value: smtpUser || '' },
      { key: 'smtpPass', value: passToStore },
      { key: 'smtpFromName', value: smtpFromName || DEFAULTS.smtpFromName },
      { key: 'smtpSecure', value: smtpSecure === false ? 'false' : 'true' },
    ];

    for (const { key, value } of updates) {
      await prisma.appConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ success: true, message: 'SMTP配置已保存' });
  } catch (error) {
    console.error('Error saving SMTP config:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
