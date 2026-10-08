import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';

/**
 * 从Excel导入产品策略类型
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

    // 读取Excel文件
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws) as any[];

    let updateCount = 0;
    const errors: string[] = [];

    // 处理每一行数据
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const productCode = row['产品代码'] || row['productCode'];
      const productName = row['产品名称'] || row['productName'];
      const primaryStrategy = row['一级策略'] || row['primaryStrategy'] || '';
      const secondaryStrategy = row['二级策略'] || row['secondaryStrategy'] || '';
      const category = row['分类分层'] || row['category'] || '';
      const fundManager = row['基金管理人'] || row['fundManager'] || '';
      const managerScale = row['管理人规模'] || row['managerScale'] || '';

      if (!productCode) {
        errors.push(`第${i + 2}行: 缺少产品代码`);
        continue;
      }

      try {
        // 更新或创建策略映射
        await prisma.strategyMapping.upsert({
          where: {
            productCode: String(productCode),
          },
          update: {
            primaryStrategy: String(primaryStrategy),
            secondaryStrategy: String(secondaryStrategy),
            category: String(category),
            productName: String(productName || ''),
            fundManager: fundManager ? String(fundManager) : null,
            managerScale: managerScale ? String(managerScale) : null,
          },
          create: {
            productCode: String(productCode),
            productName: String(productName || ''),
            primaryStrategy: String(primaryStrategy),
            secondaryStrategy: String(secondaryStrategy),
            category: String(category),
            fundManager: fundManager ? String(fundManager) : null,
            managerScale: managerScale ? String(managerScale) : null,
          },
        });

        updateCount++;
      } catch (error: any) {
        errors.push(`第${i + 2}行 (${productCode}): ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      updateCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('导入Excel失败:', error);
    return NextResponse.json(
      { error: '导入Excel失败', details: error.message },
      { status: 500 }
    );
  }
}
