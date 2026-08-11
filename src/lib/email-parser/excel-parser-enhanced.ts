/**
 * Excel解析增强版 - 修复95封失败邮件
 * 
 * 修复内容:
 * 1. 增强多级表头解析 - 正确识别标题行和数据行
 * 2. 增强纵向键值对字段映射 - 支持带冒号的字段名
 * 3. 增强日期提取 - 从Excel的任意位置提取日期
 */

import * as XLSX from 'xlsx';

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  hasTwoLevelHeader?: boolean;
  isVertical?: boolean;
}

/**
 * 解析Excel文件(Buffer) - 增强版
 */
export function parseExcelBuffer(buffer: Buffer, emailSubject?: string): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: ParsedSheet[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (rawData.length < 2) continue;
    
    // 🚨 修复优先级调整: 先检测纵向表格，再检测多级表头
    // 策略1: 检测纵向表格（键值对格式）
    const verticalResult = parseVerticalTable(rawData, sheetName, emailSubject);
    if (verticalResult) {
      sheets.push(verticalResult);
      continue;
    }
    
    // 策略2: 增强多级表头检测 - 更智能地识别标题行和数据行
    const twoLevelResult = parseTwoLevelHeaderEnhanced(rawData, sheetName, worksheet, emailSubject);
    if (twoLevelResult) {
      sheets.push(twoLevelResult);
      continue;
    }
    
    // 策略3: 标准表头解析
    const standardResult = parseStandardHeader(rawData, sheetName);
    if (standardResult) {
      sheets.push(standardResult);
    }
  }
  
  return sheets;
}

/**
 * 🚨 修复1: 增强版多级表头解析
 */
function parseTwoLevelHeaderEnhanced(
  data: any[][], 
  sheetName: string, 
  worksheet: any,
  emailSubject?: string
): ParsedSheet | null {
  
  // 扫描前15行
  for (let i = 0; i < Math.min(15, data.length - 2); i++) {
    const row1 = data[i] || [];
    const row2 = data[i + 1] || [];
    
    // 🚨 关键修复: 更严格地排除纵向表格
    // 纵向表格特征: 包含冒号且列数较少（<=5列）
    const row1Text = row1.join(' ').trim();
    const row1NonEmpty = row1.filter((cell: any) => 
      cell !== null && cell !== undefined && String(cell).trim() !== ''
    ).length;
    
    // 如果第一列包含冒号，且总列数<=5，极可能是纵向表格
    const firstCellHasColon = row1[0] && (String(row1[0]).includes('：') || String(row1[0]).includes(':'));
    const isLikelyVertical = firstCellHasColon && row1NonEmpty <= 3;
    
    if (isLikelyVertical) {
      console.log(`[增强解析] 跳过疑似纵向表格行${i + 1}: ${row1Text.substring(0, 50)}`);
      continue;
    }
    
    // 检查第1行是否为标题行（仅当列数>3时才可能是多级表头）
    if (row1NonEmpty > 5) continue;
    
    const isTitleRow = row1Text.includes('浏览表') || row1Text.includes('专用表') || 
                       row1Text.includes('净值表') || row1Text.includes('资产净值表');
    
    if (isTitleRow) {
      // 🚨 关键修复: 找到标题行后，继续向下查找真正的表头行
      console.log(`[增强解析] 行${i + 1}是标题行: ${row1Text.substring(0, 50)}`);
      
      // 从标题行下方开始查找表头行（包含"产品名称"、"产品代码"、"单位净值"等关键词）
      let headerRow1Idx = -1;
      let headerRow2Idx = -1;
      
      for (let j = i + 1; j < Math.min(i + 5, data.length - 1); j++) {
        const checkRow = data[j] || [];
        const checkText = checkRow.join(' ').trim();
        
        // 检测是否包含表头关键词
        const hasHeaderKeywords = 
          checkText.includes('产品名称') || 
          checkText.includes('产品代码') ||
          checkText.includes('基金代码') ||
          checkText.includes('单位净值') ||
          checkText.includes('资产净值');
        
        if (hasHeaderKeywords && headerRow1Idx === -1) {
          headerRow1Idx = j;
          console.log(`[增强解析] 找到表头行1: 行${j + 1}`);
          
          // 检查下一行是否是子表头
          const nextRow = data[j + 1] || [];
          const nextText = nextRow.join(' ').trim();
          if (nextText.includes('单位净值') || nextText.includes('累计净值') || nextText.includes('资产净值')) {
            headerRow2Idx = j + 1;
            console.log(`[增强解析] 找到表头行2: 行${j + 2}`);
          }
          break;
        }
      }
      
      if (headerRow1Idx >= 0) {
        return parseMultiLevelHeaderEnhanced(
          data, 
          sheetName, 
          worksheet, 
          headerRow1Idx, 
          headerRow2Idx,
          emailSubject
        );
      }
    }
  }
  
  return null;
}

/**
 * 🚨 修复1: 增强版多级表头解析器
 */
function parseMultiLevelHeaderEnhanced(
  data: any[][],
  sheetName: string,
  worksheet: any,
  headerRow1Idx: number,
  headerRow2Idx: number,
  emailSubject?: string
): ParsedSheet | null {
  
  const headerRow1 = data[headerRow1Idx] || [];
  const headerRow2 = headerRow2Idx >= 0 ? data[headerRow2Idx] || [] : [];
  
  console.log(`[增强解析] 多级表头 - 行${headerRow1Idx + 1}:`, JSON.stringify(headerRow1));
  if (headerRow2Idx >= 0) {
    console.log(`[增强解析] 多级表头 - 行${headerRow2Idx + 1}:`, JSON.stringify(headerRow2));
  }
  
  // 🚨 修复2: 提前从Excel中提取日期（从标题行附近查找）
  let extractedDate = '';
  
  // 向前扫描5行
  for (let scanRow = Math.max(0, headerRow1Idx - 5); scanRow < headerRow1Idx; scanRow++) {
    const scanRowData = data[scanRow] || [];
    for (const cell of scanRowData) {
      if (!cell) continue;
      const cellStr = String(cell).trim();
      
      // 匹配"日期：2026-08-07"格式
      const dateMatch = cellStr.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        extractedDate = dateMatch[1];
        console.log(`[增强解析] 从Excel提取日期: ${extractedDate}`);
        break;
      }
    }
    if (extractedDate) break;
  }
  
  // 🚨 如果Excel中没有日期，从邮件主题提取
  if (!extractedDate && emailSubject) {
    const subjectDateMatch = emailSubject.match(/(\d{4}-\d{2}-\d{2})/);
    if (subjectDateMatch) {
      extractedDate = subjectDateMatch[1];
      console.log(`[增强解析] 从邮件主题提取日期: ${extractedDate}`);
    }
  }
  
  // 构建合并表头
  const mergedHeaders: string[] = [];
  const headerColMap: Array<{ header: string; colIndex: number }> = [];
  
  const maxCols = Math.max(
    headerRow1.length, 
    headerRow2.length,
    ...data.slice(headerRow1Idx + 1).map((row: any[]) => row.length)
  );
  
  for (let col = 0; col < maxCols; col++) {
    const val1 = headerRow1[col] ? String(headerRow1[col]).trim() : '';
    const val2 = headerRow2[col] ? String(headerRow2[col]).trim() : '';
    
    // 跳过空值
    if (!val1 && !val2) continue;
    
    // 处理"产品代码"、"基金代码"
    if (val1 === '产品代码' || val1 === '基金代码' || val1 === '资产代码') {
      const alreadyExists = headerColMap.some(h => h.header === '产品代码');
      if (!alreadyExists) {
        headerColMap.push({ header: '产品代码', colIndex: col });
        mergedHeaders.push('产品代码');
      }
      continue;
    }
    
    // 处理"产品名称"
    if (val1 === '产品名称' || val1 === '基金名称') {
      const alreadyExists = headerColMap.some(h => h.header === '产品名称');
      if (!alreadyExists) {
        headerColMap.push({ header: '产品名称', colIndex: col });
        mergedHeaders.push('产品名称');
      }
      continue;
    }
    
    // 处理"净值情况"父级表头
    if (val1 === '净值情况') {
      if (val2) {
        headerColMap.push({ header: val2, colIndex: col });
        mergedHeaders.push(val2);
      }
      continue;
    }
    
    // 处理其他字段
    let finalHeader = '';
    if (val1 && val2 && val1 !== val2) {
      // 检查是否是无效组合
      const isInvalidCombo = (val1.includes('代码')) && 
                             (val2.includes('净值') || val2.includes('资产'));
      
      if (isInvalidCombo) {
        finalHeader = val1;
      } else {
        finalHeader = `${val1}-${val2}`;
      }
    } else if (val1) {
      finalHeader = val1;
    } else if (val2) {
      finalHeader = val2;
    }
    
    if (finalHeader && !finalHeader.startsWith('Column')) {
      headerColMap.push({ header: finalHeader, colIndex: col });
      mergedHeaders.push(finalHeader);
    }
  }
  
  console.log(`[增强解析] 最终表头:`, mergedHeaders.join(', '));
  
  // 查找数据行起始位置
  let dataStartRow = headerRow2Idx >= 0 ? headerRow2Idx + 1 : headerRow1Idx + 1;
  
  // 🚨 关键修复: 验证找到的行是否真的是数据行（包含实际净值数据）
  for (let checkRow = dataStartRow; checkRow < data.length; checkRow++) {
    const row = data[checkRow] || [];
    const hasActualData = row.some((cell: any) => {
      if (!cell) return false;
      const val = String(cell).trim();
      // 检查是否是数值（净值）
      return !isNaN(parseFloat(val)) && isFinite(parseFloat(val));
    });
    
    if (hasActualData) {
      dataStartRow = checkRow;
      console.log(`[增强解析] 数据行起始: 行${checkRow + 1}`);
      break;
    }
  }
  
  // 解析数据行
  const rows: Record<string, string>[] = [];
  
  for (let rowIdx = dataStartRow; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx] || [];
    
    // 跳过空行
    const nonEmptyCells = row.filter((cell: any) => 
      cell !== null && cell !== undefined && String(cell).trim() !== ''
    ).length;
    
    if (nonEmptyCells === 0) continue;
    
    const rowObj: Record<string, string> = {};
    
    // 使用headerColMap映射列
    headerColMap.forEach(({ header, colIndex }) => {
      const value = row[colIndex];
      if (value !== null && value !== undefined) {
        const valStr = String(value).trim();
        if (valStr) {
          rowObj[header] = valStr;
        }
      }
    });
    
    // 🚨 修复3: 注入提取的日期
    if (extractedDate && !rowObj['日期'] && !rowObj['navDate']) {
      rowObj['日期'] = extractedDate;
    }
    
    // 验证行数据
    if (Object.values(rowObj).some(val => val !== '')) {
      rows.push(rowObj);
    }
  }
  
  if (rows.length > 0) {
    console.log(`[增强解析] ✅ 解析成功: ${rows.length}行数据`);
    console.log(`[增强解析] 第1行:`, JSON.stringify(rows[0]));
    
    return {
      sheetName,
      headers: mergedHeaders,
      rows,
      hasTwoLevelHeader: true,
    };
  }
  
  return null;
}

/**
 * 策略2: 解析纵向表格（键值对格式）
 * 🚨 修复2: 增强字段映射，支持带冒号的字段名
 */
function parseVerticalTable(data: any[][], sheetName: string, emailSubject?: string): ParsedSheet | null {
  const maxCols = Math.max(...data.map(row => row.length));
  
  // 🚨 关键修复: 纵向表格通常列数较少（2-5列）
  if (maxCols < 2 || maxCols > 5) return null;
  
  // 🚨 增强检测: 扫描前10行，查找带冒号的键值对
  let verticalKeyValueCount = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i] || [];
    if (row.length >= 2) {
      const firstCell = String(row[0] || '').trim();
      // 检查是否包含冒号（纵向表格的特征）
      if (firstCell.includes('：') || firstCell.includes(':')) {
        verticalKeyValueCount++;
      }
    }
  }
  
  // 如果前10行中没有至少2行带冒号的键值对，则不是纵向表格
  if (verticalKeyValueCount < 2) {
    return null;
  }
  
  console.log(`[纵向检测] 发现${verticalKeyValueCount}个键值对行，确认为纵向表格`);
  
  // 提取所有非空单元格
  const cells = data
    .flat()
    .filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    .map(cell => String(cell).trim());
  
  if (cells.length < 4) return null;
  
  // 🚨 修复2: 增强字段映射模式
  const keyValuePatterns = [
    // 🚨 关键: 带冒号的变体放在前面
    { pattern: /(基金代码|产品代码|资产代码|代码)[:：]/i, field: '产品代码' },
    { pattern: /(基金名称|产品名称|账套名称|名称)[:：]/i, field: '产品名称' },
    { pattern: /(基金份额累计净值|累计净值|累计单位净值)[:：]/i, field: '累计净值' },
    { pattern: /(基金份额净值|单位净值|产品单位净值)[:：]/i, field: '单位净值' },
    { pattern: /(净值日期|日期|估值日期|统计日|打印日期)[:：]/i, field: '日期' },
    // 不带冒号的变体
    { pattern: /^(基金代码|产品代码|资产代码|代码)$/i, field: '产品代码' },
    { pattern: /^(基金名称|产品名称|账套名称|名称)$/i, field: '产品名称' },
    { pattern: /^(基金份额累计净值|累计净值|累计单位净值)$/i, field: '累计净值' },
    { pattern: /^(基金份额净值|单位净值|产品单位净值)$/i, field: '单位净值' },
    { pattern: /^(净值日期|日期|估值日期|统计日|打印日期)$/i, field: '日期' },
  ];
  
  const record: Record<string, string> = {};
  
  // 🚨 关键修复: 按行解析而不是按单元格解析
  for (let i = 0; i < data.length; i++) {
    const row = data[i] || [];
    if (row.length < 2) continue;
    
    const firstCell = String(row[0] || '').trim();
    
    // 检查第一列是否包含冒号
    if (firstCell.includes('：') || firstCell.includes(':')) {
      const separator = firstCell.includes('：') ? '：' : ':';
      const parts = firstCell.split(separator);
      const key = parts[0].trim();
      
      // 值可能在同一行的第2列或第3列
      let value = '';
      for (let col = 1; col < Math.min(row.length, 4); col++) {
        const cellVal = String(row[col] || '').trim();
        if (cellVal && cellVal !== '无') {
          value = cellVal;
          break;
        }
      }
      
      if (!value) continue;
      
      // 匹配字段
      for (const { pattern, field } of keyValuePatterns) {
        if (pattern.test(key + separator)) {
          if (!record[field]) {
            record[field] = value;
            console.log(`[纵向解析] ✅ ${key} → ${field}: ${value}`);
          }
          break;
        }
      }
    }
  }
  
  console.log(`[纵向解析] 结果:`, JSON.stringify(record));
  
  // 🚨 优化: 降低必填字段要求（允许缺少产品代码，稍后从邮件主题提取）
  // 关键修复: 只要求单位净值，日期可以从邮件主题提取
  if (!record['单位净值']) {
    console.log(`[纵向解析] ⚠️ 缺少单位净值`);
    return null;
  }
  
  // 如果缺少日期，从邮件主题提取
  if (!record['日期'] && emailSubject) {
    const dateMatch = emailSubject.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      record['日期'] = dateMatch[1];
      console.log(`[纵向解析] 从邮件主题提取日期: ${record['日期']}`);
    }
  }
  
  // 转换为标准横向表格
  const headers = ['日期', '产品代码', '产品名称', '单位净值', '累计净值'];
  const row: Record<string, string> = {};
  
  headers.forEach(h => {
    row[h] = record[h] || '';
  });
  
  return {
    sheetName,
    headers,
    rows: [row],
    isVertical: true,
  };
}

/**
 * 策略3: 标准表头解析
 * 🚨 修复: 清理表头中的换行符和括号内容
 */
function parseStandardHeader(data: any[][], sheetName: string): ParsedSheet | null {
  const headers: string[] = [];
  
  data[0].forEach((cell: any) => {
    if (!cell) return;
    const val = String(cell).trim();
    
    // 🚨 关键修复: 清理换行符、括号、中英文混合
    const cleaned = val
      .replace(/[\n\r]/g, ' ')  // 换行符替换为空格
      .split(/[（(]/)[0]        // 去除括号内容
      .trim();
    
    if (cleaned) {
      headers.push(cleaned);
    }
  });
  
  // 过滤空表头
  if (headers.filter(h => h).length < 2) return null;
  
  const rows: Record<string, string>[] = [];
  
  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx] || [];
    const rowObj: Record<string, string> = {};
    
    headers.forEach((header, colIdx) => {
      if (header) {
        const value = row[colIdx];
        if (value !== null && value !== undefined) {
          rowObj[header] = String(value).trim();
        }
      }
    });
    
    // 过滤空行
    if (Object.values(rowObj).some(val => val !== '')) {
      rows.push(rowObj);
    }
  }
  
  if (rows.length > 0) {
    return {
      sheetName,
      headers,
      rows,
    };
  }
  
  return null;
}

/**
 * 查找包含净值数据的Sheet
 */
export function findNavSheet(sheets: ParsedSheet[]): ParsedSheet | null {
  const navKeywords = [
    '净值', 'NAV', '单位净值', '累计净值',
    '产品代码', '基金代码', '日期', '产品名称'
  ];
  
  let bestSheet: ParsedSheet | null = null;
  let bestScore = 0;
  
  for (const sheet of sheets) {
    const headerText = sheet.headers.join(' ');
    let score = 0;
    
    // 计算匹配得分
    for (const kw of navKeywords) {
      if (headerText.includes(kw)) {
        score++;
      }
    }
    
    // 2级表头和纵向表格优先
    if (sheet.hasTwoLevelHeader) score += 2;
    if (sheet.isVertical) score += 1;
    
    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheet;
    }
  }
  
  // 至少匹配1个关键词,或只有1个Sheet
  if (bestScore >= 1 || sheets.length === 1) {
    return bestSheet || sheets[0];
  }
  
  return null;
}
