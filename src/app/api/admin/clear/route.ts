import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { all = false, dataDate, startDate, endDate } = body;

    if (all) {
      // 清空所有数据
      await prisma.fundProduct.deleteMany({});
      return NextResponse.json({
        success: true,
        message: '所有数据已清空',
      });
    } else if (startDate || endDate) {
      // 按日期范围删除（使用 raw SQL，因为 dataDate 存的是 Unix 时间戳整数）
      let whereClause = '';
      if (startDate) {
        const startTs = new Date(startDate + 'T00:00:00.000Z').getTime();
        whereClause += `dataDate >= ${startTs}`;
      }
      if (endDate) {
        const endTs = new Date(endDate + 'T00:00:00.000Z').getTime();
        if (whereClause) whereClause += ' AND ';
        whereClause += `dataDate <= ${endTs}`;
      }

      const deleted = await prisma.$executeRawUnsafe(
        `DELETE FROM FundProduct WHERE ${whereClause}`
      );

      let dateDesc = '';
      if (startDate && endDate) {
        dateDesc = `${startDate} 至 ${endDate}`;
      } else if (startDate) {
        dateDesc = `${startDate} 之后`;
      } else if (endDate) {
        dateDesc = `${endDate} 之前`;
      }

      return NextResponse.json({
        success: true,
        message: `已删除 ${dateDesc} 的 ${deleted} 条记录`,
      });
    } else if (dataDate) {
      // 删除指定日期的数据
      const targetTimestamp = new Date(dataDate + 'T00:00:00.000Z').getTime();
      const deleted = await prisma.$executeRawUnsafe(
        `DELETE FROM FundProduct WHERE dataDate = ${targetTimestamp}`
      );
      return NextResponse.json({
        success: true,
        message: `已删除 ${dataDate} 的 ${deleted} 条记录`,
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