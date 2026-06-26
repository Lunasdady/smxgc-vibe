import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { extractDataDateFromFilename } from '@/lib/stats';
import { STRATEGY_MAP } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const manualDate = formData.get('dataDate') as string;

    if (!file) {
      return NextResponse.json(
        { error: '请选择文件' },
        { status: 400 }
      );
    }

    console.log('📁 接收文件:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // 解析文件名中的日期
    let dataDate: string = manualDate || '';
    if (!dataDate) {
      const extracted = extractDataDateFromFilename(file.name);
      dataDate = extracted || '';
    }

    if (!dataDate) {
      return NextResponse.json(
        { error: '无法从文件名解析日期，请手动指定' },
        { status: 400 }
      );
    }

    // 读取 Excel 文件
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const previewData: Record<string, number> = {};

    // 遍历所有 Sheet
    for (const sheetName of workbook.SheetNames) {
      console.log(`📄 解析 Sheet: "${sheetName}"`);

      try {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // 查找策略类型（根据你的业务逻辑）
        let strategyType: string | null = null;
        for (const key of Object.keys(STRATEGY_MAP)) {
          if (sheetName.includes(key) || key.includes(sheetName)) {
            strategyType = key;
            break;
          }
        }

        if (!strategyType) {
          console.warn(`⚠️ 无法识别 Sheet "${sheetName}" 的策略类型，跳过`);
          continue;
        }

        // 统计有效数据行数
        let actualRowCount = 0;
        for (const row of jsonData) {
          // 过滤空行（根据你的业务逻辑判断）
          const values = Object.values(row as Record<string,any>) as string[];
          if (values.some(v => v && v.toString().trim() !== '')) {
            actualRowCount++;
          }
        }

        previewData[strategyType] = actualRowCount;
        console.log(`  ↳ 真实数据行数: ${actualRowCount}`);
      } catch (sheetError) {
        console.error(`❌ 解析 Sheet "${sheetName}" 失败:`, sheetError);
      }
    }

    console.log('✅ 解析完成:', previewData);

    return NextResponse.json({
      success: true,
      dataDate,
      strategies: previewData,
      message: '文件解析成功',
    });
  } catch (error) {
    console.error('❌ Error parsing Excel file:', error);
    return NextResponse.json(
      {
        error: `文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        debug: {
          message: '请检查文件格式是否正确',
        }
      },
      { status: 500 }
    );
  }
}
