import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { all = false, dataDate } = body;

    if (all) {
      // 清空所有数据
      await prisma.fundProduct.deleteMany({});
      return NextResponse.json({
        success: true,
        message: '所有数据已清空',
      });
    } else if (dataDate) {
      // 删除指定日期的数据
      const date = new Date(dataDate);
      const deleted = await prisma.fundProduct.deleteMany({
        where: { dataDate: date },
      });
      return NextResponse.json({
        success: true,
        message: `已删除 ${dataDate} 的 ${deleted.count} 条记录`,
      });
    } else {
      return NextResponse.json(
        { error: '请指定清空范围' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error clearing data:', error);
    return NextResponse.json(
      { error: '清空数据失败' },
      { status: 500 }
    );
  }
}