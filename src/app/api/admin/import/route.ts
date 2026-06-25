import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import { STRATEGY_MAP, STRATEGY_NAME_MAP } from '@/lib/types';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';

// 内存存储导入进度（生产环境应使用Redis等）
// 使用全局变量以便跨模块访问
const importProgressMap = new Map<string, {
  progress: number;
  total: number;
  current: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  result?: any;
}>();

// 存储到全局变量供进度查询API使用
(globalThis as any).__importProgressMap = importProgressMap;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dataDateStr = formData.get('dataDate') as string;
    const conflictAction = (formData.get('conflictAction') as string) || 'skip';

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    if (!dataDateStr) {
      return NextResponse.json({ error: '请指定数据日期' }, { status: 400 });
    }

    const dataDate = new Date(dataDateStr);

    // 检查是否已存在该日期的数据
    const existingCount = await prisma.fundProduct.count({
      where: { dataDate },
    });

    if (existingCount > 0 && conflictAction === 'skip') {
      return NextResponse.json(
        { error: `该日期已存在 ${existingCount} 条记录，请选择覆盖或跳过` },
        { status: 409 }
      );
    }

    // 如果覆盖，先删除旧数据
    if (conflictAction === 'overwrite') {
      await prisma.fundProduct.deleteMany({
        where: { dataDate },
      });
    }

    // 生成导入任务ID
    const importId = randomUUID();

    // 异步执行导入任务
    executeImport(file, dataDate, importId).catch(err => {
      console.error('导入任务失败:', err);
      importProgressMap.set(importId, {
        progress: 0,
        total: 0,
        current: 0,
        status: 'failed',
        message: '导入失败: ' + (err.message || '未知错误'),
      });
    });

    return NextResponse.json({
      success: true,
      importId,
      message: '导入任务已启动',
    });
  } catch (error) {
    console.error('Error starting import:', error);
    return NextResponse.json(
      { error: '数据导入失败' },
      { status: 500 }
    );
  }
}

// 异步执行导入任务
async function executeImport(file: File, dataDate: Date, importId: string) {
  const fileName = file.name.toLowerCase();
  let workbook: XLSX.WorkBook;

  // 读取文件内容
  const arrayBuffer = await file.arrayBuffer();

  try {
    if (fileName.endsWith('.csv')) {
      try {
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        workbook = XLSX.read(text, { type: 'string', codepage: 65001 });
      } catch {
        console.log('⚠️ CSV 文本解析失败，回退到二进制解析');
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }
    } else {
      workbook = XLSX.read(arrayBuffer, { type: 'array' });
    }
  } catch (parseError) {
    console.error('❌ 文件解析失败:', parseError);
    importProgressMap.set(importId, {
      progress: 0,
      total: 0,
      current: 0,
      status: 'failed',
      message: `Excel 文件解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`,
    });
    return;
  }

  // 计算总数据量
  let totalRows = 0;
  const sheetData: Array<{ sheetName: string; strategyType: string; rows: any[][]; headers: string[] }> = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rawData.length < 2) continue;

    // 查找策略类型
    let strategyType = 'unknown';
    for (const [cnName, type] of Object.entries(STRATEGY_MAP)) {
      if (sheetName.includes(cnName)) {
        strategyType = type;
        break;
      }
    }

    if (strategyType === 'unknown') {
      console.log(`⚠️ Sheet "${sheetName}" 未匹配到策略类型，跳过`);
      continue;
    }

    // 处理双层表头：第1行（索引1）是真正的列名
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1 });
    const headers = data[0] as string[];
    const allRows = data.slice(1) as any[][];
    
    // 过滤空行，只统计真实数据行
    const rows = allRows.filter(row => {
      return Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '');
    });

    totalRows += rows.length;
    sheetData.push({ sheetName, strategyType, rows, headers });
  }

  // 初始化进度
  importProgressMap.set(importId, {
    progress: 0,
    total: totalRows,
    current: 0,
    status: 'processing',
    message: '开始导入数据...',
  });

  let totalImported = 0;
  const importResults: Record<string, number> = {};
  let currentProcessed = 0;

  // 逐个sheet导入
  for (const { sheetName, strategyType, rows, headers } of sheetData) {
    console.log(`📋 Sheet "${sheetName}" -> ${strategyType}: ${rows.length} 条数据`);

    let sheetImported = 0;

    for (const row of rows) {
      // 将数组转换为对象（只使用字符串类型的列名，跳过数字等伪列名）
      const rowObj: Record<string, any> = {};
      headers.forEach((header, i) => {
        if (header && typeof header === 'string') rowObj[header] = row[i];
      });

      // 跳过没有产品名称的行
      if (!rowObj['产品名称']) {
        continue;
      }

      try {
        await prisma.fundProduct.create({
          data: {
            dataDate,
            strategyType,
            fundManager: String(rowObj['基金管理人'] || ''),
            managerScale: String(rowObj['管理人规模'] || ''),
            isLargeScale: String(rowObj['管理人规模'] || '').includes('100亿'),
            productName: String(rowObj['产品名称'] || ''),
            strategyCategory: rowObj['策略分类'] ? String(rowObj['策略分类']) : null,
            weeklyReturn: parseDecimalNumber(rowObj['近一周收益']),
            monthlyReturn: parseDecimalNumber(rowObj['近一月收益']),
            ytdReturn: parseDecimalNumber(rowObj['今年以来收益']),
            annualizedReturnSinceInception: parseDecimalNumber(rowObj['成立以来年化收益']),
            ytdMaxDrawdown: parseDecimalNumber(rowObj['今年以来最大回撤']),
            inceptionMaxDrawdown: parseDecimalNumber(rowObj['成立以来最大回撤']),
            annualizedVolatility: parseDecimalNumber(rowObj['成立以来年化波动率']),
            sharpeRatio: parseDecimalNumber(rowObj['成立以来夏普比率']),
          },
        });
        sheetImported++;
        totalImported++;
      } catch (e) {
        console.error(`❌ 导入失败 [${strategyType}]:`, e);
      }

      currentProcessed++;
      
      // 更新进度
      const progress = Math.round((currentProcessed / totalRows) * 100);
      importProgressMap.set(importId, {
        progress,
        total: totalRows,
        current: currentProcessed,
        status: 'processing',
        message: `正在导入 ${STRATEGY_NAME_MAP[strategyType] || strategyType}... (${currentProcessed}/${totalRows})`,
      });
    }

    if (sheetImported > 0) {
      importResults[strategyType] = sheetImported;
    }
  }

  // 导入完成
  importProgressMap.set(importId, {
    progress: 100,
    total: totalRows,
    current: totalRows,
    status: 'completed',
    message: `数据导入成功！共导入 ${totalImported} 条记录`,
    result: {
      success: true,
      message: `数据导入成功！共导入 ${totalImported} 条记录`,
      date: dayjs(dataDate).format('YYYY-MM-DD'),
      imported: importResults,
    },
  });

  console.log(`✅ 导入完成！共导入 ${totalImported} 条记录`, importResults);

  // 5分钟后清理进度数据
  setTimeout(() => {
    importProgressMap.delete(importId);
  }, 5 * 60 * 1000);
}

/**
 * 解析小数形式的数字（如0.0964表示9.64%）
 * Excel中的收益数据以小数形式存储，需要转换为百分比
 */
function parseDecimalNumber(value: any): number | null {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return null;
  }
  // 如果是小数形式（绝对值小于1且不为0），转换为百分比
  if (Math.abs(num) < 1 && num !== 0) {
    return num * 100;
  }
  return num;
}
