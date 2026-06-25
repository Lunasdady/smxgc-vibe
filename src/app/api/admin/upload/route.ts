import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { extractDataDateFromFilename } from '@/lib/stats';
import { STRATEGY_MAP } from '@/lib/types';

// 禁用 bodyParser 以支持文件上传
export const config = {
  api: {
    bodyParser: false,
  },
};

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

    console.log('📅 数据日期:', dataDate);

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    console.log('📊 文件大小 (bytes):', arrayBuffer.byteLength);
    
    // 根据文件扩展名选择解析方式
    const fileName = file.name.toLowerCase();
    let workbook: XLSX.WorkBook;

    try {
      if (fileName.endsWith('.csv')) {
        try {
          // CSV 文件需要特殊处理
          const text = new TextDecoder('utf-8').decode(arrayBuffer);
          workbook = XLSX.read(text, { type: 'string', codepage: 65001 });
        } catch {
          // CSV 文本解析失败，可能是扩展名为 .csv 但实际为 xlsx 格式
          console.log('⚠️ CSV 文本解析失败，回退到二进制解析');
          workbook = XLSX.read(arrayBuffer, { type: 'array' });
        }
      } else {
        // Excel 文件
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }
    } catch (parseError) {
      console.error('❌ 文件解析失败:', parseError);
      return NextResponse.json(
        { 
          error: `Excel 文件解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`,
          debug: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }
        },
        { status: 500 }
      );
    }

    console.log('📊 Sheet 列表:', workbook.SheetNames);

    // 解析所有 Sheet
    const strategies: Record<string, any[]> = {};
    const previewData: Record<string, number> = {};

    for (const sheetName of workbook.SheetNames) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`📋 Sheet "${sheetName}": ${data.length} 行（包含空行）`);

        if (data.length === 0) continue;

        // 查找策略类型
        let strategyType = 'unknown';
        for (const [cnName, type] of Object.entries(STRATEGY_MAP)) {
          if (sheetName.includes(cnName)) {
            strategyType = type;
            break;
          }
        }

        console.log(`  ↳ 匹配策略: ${sheetName} -> ${strategyType}`);

        strategies[strategyType] = data;
        
        // 统计真实数据行数（排除空行和表头）
        let actualRowCount = 0;
        for (let i = 1; i < data.length; i++) { // 从索引1开始，跳过表头
          const row = data[i];
          // 检查是否为空行：数组为空，或所有单元格都为空
          if (Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
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