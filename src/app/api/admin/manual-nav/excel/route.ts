import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';

/**
 * 导出手工维护的净值数据为 Excel
 */
export async function GET() {
  try {
    // 查询所有手工数据
    const navData = await prisma.navData.findMany({
      where: { source: 'manual' },
      orderBy: { navDate: 'desc' },
    });

    // 准备导出数据
    const data = navData.map((nav: any, index: number) => ({
      '序号': index + 1,
      '产品代码': nav.productCode,
      '产品名称': nav.productName,
      '净值日期': nav.navDate.toISOString().split('T')[0],
      '单位净值': nav.unitNav,
      '累计净值': nav.cumulativeNav || '',
      '数据来源': nav.source,
      '置信度': nav.confidence,
    }));

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '手工净值数据');

    // 设置列宽
    ws['!cols'] = [
      { wch: 8 },   // 序号
      { wch: 12 },  // 产品代码
      { wch: 40 },  // 产品名称
      { wch: 12 },  // 净值日期
      { wch: 12 },  // 单位净值
      { wch: 12 },  // 累计净值
      { wch: 10 },  // 数据来源
      { wch: 10 },  // 置信度
    ];

    // 生成 Buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="manual_nav_data_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('导出Excel失败:', error);
    return NextResponse.json(
      { error: '导出失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 从 Excel 导入手工净值数据
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '请上传Excel文件' },
        { status: 400 }
      );
    }

    // 读取 Excel 文件
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Excel文件为空' },
        { status: 400 }
      );
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 逐行导入
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      
      try {
        const productCode = String(row['产品代码'] || row['productCode'] || '').trim();
        const productName = String(row['产品名称'] || row['productName'] || '').trim();
        const navDateStr = String(row['净值日期'] || row['navDate'] || '').trim();
        const unitNav = parseFloat(row['单位净值'] || row['unitNav']);
        const cumulativeNav = row['累计净值'] || row['cumulativeNav'];

        // 验证必填字段
        if (!productCode || !productName || !navDateStr || isNaN(unitNav)) {
          errors.push(`第${i + 2}行: 缺少必填字段`);
          errorCount++;
          continue;
        }

        // 解析日期
        const navDate = new Date(navDateStr);
        if (isNaN(navDate.getTime())) {
          errors.push(`第${i + 2}行: 日期格式无效`);
          errorCount++;
          continue;
        }

        // 检查是否已存在
        const existing = await prisma.navData.findUnique({
          where: {
            productCode_navDate: {
              productCode,
              navDate,
            },
          },
        });

        if (existing) {
          skipCount++;
          continue;
        }

        // 创建记录
        await prisma.navData.create({
          data: {
            productCode,
            productName,
            navDate,
            unitNav,
            cumulativeNav: cumulativeNav ? parseFloat(cumulativeNav) : null,
            source: 'manual',
            confidence: 'high',
          },
        });

        successCount++;
      } catch (error: any) {
        errors.push(`第${i + 2}行: ${error.message}`);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `导入完成: 成功 ${successCount} 条, 跳过 ${skipCount} 条, 失败 ${errorCount} 条`,
      successCount,
      skipCount,
      errorCount,
      errors: errors.slice(0, 20), // 只返回前20个错误
    });
  } catch (error: any) {
    console.error('导入Excel失败:', error);
    return NextResponse.json(
      { error: '导入失败', details: error.message },
      { status: 500 }
    );
  }
}
