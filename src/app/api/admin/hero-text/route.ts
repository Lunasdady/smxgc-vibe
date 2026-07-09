import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// 默认文案
const DEFAULT_HERO_TITLE = '穿越周期的<span class="text-[#0071E3]">价值投资</span>';
const DEFAULT_HERO_SUBTITLE = '私募星工厂全量业绩跟踪平台，实时监控多维度策略表现';

export async function GET() {
  try {
    const configs = await prisma.appConfig.findMany({
      where: {
        key: { in: ['heroTitle', 'heroSubtitle'] }
      }
    });

    const result: Record<string, string> = {};
    for (const config of configs) {
      result[config.key] = config.value;
    }

    return NextResponse.json({
      heroTitle: result.heroTitle || DEFAULT_HERO_TITLE,
      heroSubtitle: result.heroSubtitle || DEFAULT_HERO_SUBTITLE,
    });
  } catch (error) {
    console.error('Error fetching hero text:', error);
    return NextResponse.json({
      heroTitle: DEFAULT_HERO_TITLE,
      heroSubtitle: DEFAULT_HERO_SUBTITLE,
    });
  }
}

export async function POST(request: Request) {
  try {
    const { heroTitle, heroSubtitle } = await request.json();

    // UPSERT heroTitle
    await prisma.appConfig.upsert({
      where: { key: 'heroTitle' },
      update: { value: heroTitle },
      create: { key: 'heroTitle', value: heroTitle },
    });

    // UPSERT heroSubtitle
    await prisma.appConfig.upsert({
      where: { key: 'heroSubtitle' },
      update: { value: heroSubtitle },
      create: { key: 'heroSubtitle', value: heroSubtitle },
    });

    return NextResponse.json({ success: true, message: '首页文案已更新' });
  } catch (error) {
    console.error('Error saving hero text:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
