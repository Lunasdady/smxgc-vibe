import * as XLSX from 'xlsx';

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  hasTwoLevelHeader?: boolean; // 是否2级表头
  isVertical?: boolean; // 是否纵向表格
}

/**
 * 解析Excel文件(Buffer) - 增强版支持2级表头和纵向表格
 */
export function parseExcelBuffer(buffer: Buffer): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: ParsedSheet[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (rawData.length < 2) continue;
    
    // 策略1: 检测2级表头(传入worksheet以获取合并单元格信息)
    const twoLevelResult = parseTwoLevelHeader(rawData, sheetName, worksheet);
    if (twoLevelResult) {
      sheets.push(twoLevelResult);
      continue;
    }
    
    // 策略2: 检测1列纵向表格
    const verticalResult = parseVerticalTable(rawData, sheetName);
    if (verticalResult) {
      sheets.push(verticalResult);
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
 * 策略1: 解析2级表头(合并单元格)
 * 增强版: 支持3级表头+合并单元格解析
 */
function parseTwoLevelHeader(data: any[][], sheetName: string, worksheet?: any): ParsedSheet | null {
  // 扫描前15行，寻找2级或3级表头
  for (let i = 0; i < Math.min(15, data.length - 2); i++) {
    const row1 = data[i] || [];
    const row2 = data[i + 1] || [];
    
    // 🚨 修复SAZL50: 检测是否为纵向键值对表格(表头包含冒号)
    const row1Text = row1.join(' ').trim();
    const row2Text = row2.join(' ').trim();
    const hasColonInHeader = row1Text.includes('：') || row1Text.includes(':') || 
                             row2Text.includes('：') || row2Text.includes(':');
    
    if (hasColonInHeader) {
      // 这是纵向键值对表格,不应该用多级表头解析
      console.log(`[Excel调试] 行${i}包含冒号,判定为纵向表格,跳过2级表头检测`);
      continue;
    }
    
    // 检查第1行是否为标题行(1-2个非空单元格,且包含长文本)
    const row1NonEmpty = row1.filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
    
    // 🚨 修复SASS75/STF042: 允许最多5个非空单元格(如"账套名称,产品代码,日期,净值情况")
    if (row1NonEmpty > 5) continue;
    
    const isTitleRow = row1Text.includes('浏览表') || row1Text.includes('专用表') || row1Text.includes('净值表') || row1Text.includes('资产净值表');
    
    // 🚨 调试日志
    if (i < 3 && row1NonEmpty > 0) {
      console.log(`[Excel调试] 行${i}: 非空=${row1NonEmpty}, isTitleRow=${isTitleRow}, 文本=${row1Text.substring(0, 50)}`);
    }
    
    // 如果第1行是标题,检查第2行
    if (isTitleRow) {
      const row2Text = row2.join(' ').trim();
      
      // 第2行也是标题,检查第3行开始
      if (row2Text.includes('专用表') || row2Text.includes('浏览表') || row2Text.includes('资产净值表')) {
        console.log('🔍 检测到多级表头标题行(2行标题)');
        return parseMultiLevelHeader(data, sheetName, worksheet, i + 2); // 从第3行开始解析
      }
      
      // 🚨 修复SASS75: 第2行可能是表头行1(如"账套名称,产品代码,日期,净值情况")
      const row2NonEmpty = row2.filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
      if (row2NonEmpty >= 3) {
        console.log('🔍 检测到多级表头(1行标题+多级表头)');
        return parseMultiLevelHeader(data, sheetName, worksheet, i + 1); // 从第2行开始解析
      }
    }
    
    // 🚨 修复STF042: 直接检测多级表头(无标题行)
    const row1ContainsNav = row1.some((cell: any) => cell && String(cell).includes('净值'));
    if (row1NonEmpty >= 2 && row1ContainsNav) {
      console.log('🔍 检测到多级表头(无标题行)');
      return parseMultiLevelHeader(data, sheetName, worksheet, i);
    }
    
    // 原有的2级表头逻辑(保留作为fallback)
    const row2NonEmptyFallback = row2.filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
    
    // 第1行: 1-5个非空单元格
    if (row1NonEmpty < 1 || row1NonEmpty > 5) continue;
    
    // 第2行: >=2个非空单元格(🚨 修复STF042: 从3改为2)
    if (row2NonEmptyFallback < 2) continue;
    
    // 检查第1行无超长文本
    const hasLongText = row1.some((cell: any) => cell && String(cell).length > 30);
    if (hasLongText) continue;
    
    // 合并文本检查是否包含"净值"或"NAV"
    const combinedText = [...row1, ...row2].filter(c => c).join(' ');
    if (!combinedText.includes('净值') && !combinedText.toUpperCase().includes('NAV')) {
      continue;
    }
    
    // 合并表头
    const mergedHeaders: string[] = [];
    const maxCols = Math.max(row1.length, row2.length);
    
    for (let col = 0; col < maxCols; col++) {
      const val1 = row1[col] ? String(row1[col]).trim() : '';
      const val2 = row2[col] ? String(row2[col]).trim() : '';
      
      if (val1 && val2) {
        mergedHeaders.push(`${val1}-${val2}`);
      } else if (val1) {
        mergedHeaders.push(val1);
      } else if (val2) {
        mergedHeaders.push(val2);
      } else {
        mergedHeaders.push(`Column${col + 1}`);
      }
    }
    
    // 解析数据行(从第i+2行开始)
    const rows: Record<string, string>[] = [];
    for (let rowIdx = i + 2; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx] || [];
      const rowObj: Record<string, string> = {};
      
      mergedHeaders.forEach((header, colIdx) => {
        const value = row[colIdx];
        if (value !== null && value !== undefined) {
          rowObj[header] = String(value).trim();
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
        headers: mergedHeaders,
        rows,
        hasTwoLevelHeader: true,
      };
    }
  }
  
  return null;
}

/**
 * 🚨 新增: 解析多级表头(支持3级)
 * 用于SASS75/STF042等复杂表格
 */
function parseMultiLevelHeader(data: any[][], sheetName: string, worksheet: any, headerStartRow: number): ParsedSheet | null {
  const merges = worksheet?.['!merges'] || [];
  
  // 从headerStartRow开始查找表头行
  const headerRow1 = data[headerStartRow] || [];
  const headerRow2 = data[headerStartRow + 1] || [];
  
  console.log(`🔍 多级表头解析: 从第${headerStartRow}行开始`);
  console.log(`   表头行1: ${JSON.stringify(headerRow1)}`);
  console.log(`   表头行2: ${JSON.stringify(headerRow2)}`);
  
  // 🚨 关键: 使用合并单元格信息来正确解析表头
  const mergedHeaders: string[] = [];
  const maxCols = Math.max(headerRow1.length, headerRow2.length, ...data.slice(headerStartRow + 2).map((row: any[]) => row.length));
  
  // 🚨 找到表头的起始列索引
  let startColIndex = 0;
  for (let col = 0; col < maxCols; col++) {
    const val1 = headerRow1[col] ? String(headerRow1[col]).trim() : '';
    const val2 = headerRow2[col] ? String(headerRow2[col]).trim() : '';
    if (val1 || val2) {
      startColIndex = col;
      break;
    }
  }
  
  console.log(`🔍 表头起始列索引: ${startColIndex}`);
  
  // 🚨 简化策略: 不依赖合并单元格,直接按列解析
  // 表头行1: 可能有"净值情况"这样的父级表头
  // 表头行2: 实际的子表头(单位净值、累计净值等)
  
  // 先找出哪些列在表头行1有"净值情况"
  const navSituationCols: number[] = [];
  headerRow1.forEach((cell: any, colIdx: number) => {
    if (cell && String(cell).trim() === '净值情况') {
      navSituationCols.push(colIdx);
    }
  });
  
  console.log(`🔍 表头行1的"净值情况"列: ${navSituationCols.join(', ')}`);
  
  // 🚨 关键修复: 记录每个header对应的实际列索引
  const headerColMap: Array<{ header: string; colIndex: number }> = [];
  
  // 🚨 修复STF042: 处理"产品名称"跨多列合并的情况
  // 检查表头行1是否有"产品名称"且后面有列为空
  let productNameColIndex = -1;
  headerRow1.forEach((cell: any, colIdx: number) => {
    if (cell && String(cell).trim() === '产品名称') {
      productNameColIndex = colIdx;
    }
  });
  
  console.log(`🔍 "产品名称"列索引: ${productNameColIndex}`);
  
  // 🚨 修复STF042: 提前扫描日期字段（从headerStartRow向前查找）
  let extractedDate = '';
  for (let scanRow = headerStartRow - 1; scanRow >= 0; scanRow--) {
    const scanRowData = data[scanRow] || [];
    for (const cell of scanRowData) {
      if (!cell) continue;
      const cellStr = String(cell).trim();
      
      // 检查是否包含"日期"关键字
      if (cellStr.includes('日期') || cellStr.includes('Date')) {
        // 检查同一行或下一列是否有日期值
        const cellIdx = scanRowData.indexOf(cell);
        if (cellIdx >= 0 && cellIdx < scanRowData.length - 1) {
          const nextCell = scanRowData[cellIdx + 1];
          if (nextCell) {
            const dateStr = String(nextCell).trim();
            // 验证是否为日期格式
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              extractedDate = dateStr;
              console.log(`📅 从行${scanRow + 1}提取日期: ${extractedDate}`);
              break;
            }
          }
        }
        
        // 如果单元格本身就包含日期（如"日期：2026-08-07"）
        if (!extractedDate) {
          const dateMatch = cellStr.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            extractedDate = dateMatch[1];
            console.log(`📅 从行${scanRow + 1}单元格提取日期: ${extractedDate}`);
          }
        }
      }
      
      // 也检查独立的日期格式
      if (!extractedDate && /^\d{4}-\d{2}-\d{2}$/.test(cellStr)) {
        extractedDate = cellStr;
        console.log(`📅 从行${scanRow + 1}发现独立日期: ${extractedDate}`);
      }
    }
    if (extractedDate) break;
  }
  
  if (!extractedDate) {
    console.log('⚠️ 未在Excel中找到日期字段，将从邮件主题提取');
  }
  
  // 构建最终表头
  for (let col = startColIndex; col < maxCols; col++) {
    const val1 = headerRow1[col] ? String(headerRow1[col]).trim() : '';
    const val2 = headerRow2[col] ? String(headerRow2[col]).trim() : '';
    
    // 🚨 修复STF042: 处理合并单元格的情况
    // 对于"产品名称"这种跨列合并的单元格,只在第一次出现时添加
    if (val1 === '产品名称') {
      // 检查是否已经添加过
      const alreadyExists = headerColMap.some(h => h.header === '产品名称');
      if (!alreadyExists) {
        headerColMap.push({ header: '产品名称', colIndex: col });
        mergedHeaders.push('产品名称');
      }
      continue;
    }
    
    // 🚨 修复STF042: "产品代码"列不应与其他值组合
    if (val1 === '产品代码' || val1 === '基金代码') {
      const alreadyExists = headerColMap.some(h => h.header === '产品代码');
      if (!alreadyExists) {
        headerColMap.push({ header: '产品代码', colIndex: col });
        mergedHeaders.push('产品代码');
        console.log(`✅ 保护"产品代码"列，不与"${val2}"组合`);
      }
      continue;
    }
    
    // 策略:
    // 1. 如果表头行1是"净值情况",使用表头行2的值
    // 2. 如果表头行1和行2都有值,组合它们（但要排除无效组合）
    // 3. 如果只有表头行1有值,使用它
    // 4. 如果只有表头行2有值,使用它
    
    let finalHeader = '';
    if (val1 === '净值情况') {
      // 父级表头,使用子表头
      if (val2) {
        finalHeader = val2;
      }
    } else if (val1 && val2 && val1 !== val2) {
      // 🚨 修复STF042: 检查是否是错误的组合
      // 规则1: 产品代码/基金代码不应与净值类字段组合
      // 规则2: 任何包含"代码"的字段都不应与包含"净值"或"资产"的字段组合
      const isInvalidCombo = (val1.includes('代码') || val1.includes('code')) && 
                             (val2.includes('净值') || val2.includes('资产') || val2.includes('NAV'));
      
      if (isInvalidCombo) {
        // 这种情况,val2是错误的,应该使用val1
        finalHeader = val1;
        console.log(`⚠️ 检测到无效组合: ${val1}-${val2}, 使用: ${val1}`);
      } else {
        // 两者都有且不同,组合(如"基金代码-产品代码")
        finalHeader = `${val1}-${val2}`;
      }
    } else if (val1) {
      // 只有行1有值
      finalHeader = val1;
    } else if (val2) {
      // 只有行2有值
      finalHeader = val2;
    }
    
    if (finalHeader) {
      headerColMap.push({ header: finalHeader, colIndex: col });
      mergedHeaders.push(finalHeader);
    }
  }
  
  // 过滤掉空表头和重复的列
  const finalHeaders = mergedHeaders.filter((h, idx) => {
    if (!h || h.startsWith('Column')) return false;
    return idx === mergedHeaders.indexOf(h); // 去重
  });
  
  console.log('📋 多级表头合并结果:', finalHeaders.join(', '));
  
  // 🚨 查找数据行起始位置(跳过后面的空行或说明行)
  let dataStartRow = headerStartRow + 2; // 默认从表头后2行开始
  
  // 如果表头行2是子表头(如"资产净值,单位净值"),数据从表头行+2开始
  // 检查表头行2是否包含净值字段
  const hasNavFields = headerRow2.some((cell: any) => {
    const val = cell ? String(cell).trim() : '';
    return val.includes('单位净值') || val.includes('累计净值') || val.includes('资产净值');
  });
  
  if (hasNavFields) {
    dataStartRow = headerStartRow + 2; // 表头行2是子表头,数据从+2开始
  } else {
    dataStartRow = headerStartRow + 1; // 表头行2不是子表头,数据从+1开始
  }
  
  console.log(`🔍 数据行起始位置: 第${dataStartRow}行`);
  
  // 解析数据行
  const rows: Record<string, string>[] = [];
  for (let rowIdx = dataStartRow; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx] || [];
    
    // 🚨 跳过空行
    const nonEmptyCells = row.filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
    if (nonEmptyCells === 0) continue;
    
    const rowObj: Record<string, string> = {};
    
    // 🚨 关键修复: 使用headerColMap中的实际列索引
    headerColMap.forEach(({ header, colIndex }) => {
      const value = row[colIndex];
      if (value !== null && value !== undefined) {
        const valStr = String(value).trim();
        if (valStr) {
          rowObj[header] = valStr;
        }
      }
    });
    
    // 🚨 修复STF042: 如果Excel中没有日期字段，注入提取的日期
    if (extractedDate && !rowObj['日期'] && !rowObj['navDate']) {
      rowObj['日期'] = extractedDate;
      console.log(`📅 注入提取的日期到数据行: ${extractedDate}`);
    }
    
    // 过滤空行
    if (Object.values(rowObj).some(val => val !== '')) {
      rows.push(rowObj);
    }
  }
  
  if (rows.length > 0) {
    console.log(`✅ 多级表头解析完成: ${rows.length}行数据`);
    console.log(`   第1行数据: ${JSON.stringify(rows[0])}`);
    return {
      sheetName,
      headers: finalHeaders,
      rows,
      hasTwoLevelHeader: true,
    };
  }
  
  return null;
}

/**
 * 🚨 新增: 解析多列键值对格式(同一行多个键值对)
 * 用于SAZL50等表格: 一行中包含多个"键：值"对
 */
function parseMultiColumnKeyValue(data: any[][], sheetName: string): ParsedSheet | null {
  console.log('🔍 解析多列键值对格式...');
  
  const record: Record<string, string> = {};
  
  // 键值对模式匹配
  const keyValuePatterns = [
    { pattern: /(产品代码|基金代码|代码|协会备案代码)[:：]?/i, field: '产品代码' },
    { pattern: /(产品名称|基金名称|账套名称|名称)[:：]?/i, field: '产品名称' },
    { pattern: /(基金份额累计净值|累计净值|累计单位净值|产品累计单位净值)[:：]?/i, field: '累计净值' },
    { pattern: /(基金份额净值|单位净值|产品单位净值)[:：]?/i, field: '单位净值' },
    { pattern: /(净值日期|日期|估值日期|统计日|份额最新变更日期)[:：]?/i, field: '日期' },
    { pattern: /(持有产品份额|产品份额|份额)[:：]?/i, field: '份额' },
    { pattern: /(资产净值|基金资产净值)[:：]?/i, field: '资产净值' },
  ];
  
  // 遍历每一行
  for (const row of data) {
    const rowObj: Record<string, string> = {};
    
    // 遍历每一列
    for (const cell of row) {
      if (!cell) continue;
      
      const cellStr = String(cell).trim();
      if (!cellStr) continue;
      
      // 检查是否包含冒号
      const hasColon = cellStr.includes('：') || cellStr.includes(':');
      
      if (hasColon) {
        // 分离键和值
        const separator = cellStr.includes('：') ? '：' : ':';
        const parts = cellStr.split(separator);
        const key = parts[0].trim();
        let value = parts.slice(1).join(separator).trim();
        
        // 如果值为空或者是“无”，尝试下一个单元格
        if (!value || value === '无') continue;
        
        // 匹配字段
        for (const { pattern, field } of keyValuePatterns) {
          if (pattern.test(key)) {
            rowObj[field] = value;
            console.log(`  ✅ 多列匹配: ${key} → ${field}: ${value}`);
            break;
          }
        }
      }
    }
    
    // 合并到总记录
    Object.assign(record, rowObj);
  }
  
  console.log('📋 多列键值对解析结果:', JSON.stringify(record));
  
  // 验证必需字段
  if (!record['产品代码'] && !record['日期']) {
    console.log('⚠️ 缺少必填字段');
    return null;
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
 * 策略2: 解析1列或2列纵向表格(键值对格式)
 * 支持不规则格式: 键值可能在同一单元格,也可能分开
 */
function parseVerticalTable(data: any[][], sheetName: string): ParsedSheet | null {
  // 检查列数
  const maxCols = Math.max(...data.map(row => row.length));
  
  // 🚨 修复SAZL50: 支持更多列的纵向表格(键值对可能在同一行的不同列)
  if (maxCols < 1 || maxCols > 5) return null;
  
  // 提取所有非空单元格
  const cells = data
    .flat()
    .filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    .map(cell => String(cell).trim());
  
  if (cells.length < 4) return null; // 至少需要2对键值
  
  // 🚨 修复SAZL50: 检测是否为多列键值对格式(同一行多个键值对)
  const hasMultiColumnKeyValue = data.some(row => {
    const colonCount = row.filter((cell: any) => {
      const val = cell ? String(cell).trim() : '';
      return val.includes('：') || val.includes(':');
    }).length;
    return colonCount >= 2; // 一行中有2个或更多冒号，说明是多列键值对
  });
  
  if (hasMultiColumnKeyValue) {
    console.log('📋 检测到多列键值对格式(同一行多个键值对)');
    return parseMultiColumnKeyValue(data, sheetName);
  }
  
  // 键值对模式匹配(添加新别名)
  // 🚨 注意: 更具体的模式放在前面(如"基金份额累计净值"在"基金份额净值"之前)
  const keyValuePatterns = [
    { pattern: /(产品代码|基金代码|代码|协会备案代码)[:：]?$/i, field: '产品代码' },
    { pattern: /(产品名称|基金名称|账套名称|名称)[:：]?$/i, field: '产品名称' },
    // 🚨 修复: "基金份额累计净值"放在"基金份额净值"之前，避免错误匹配
    { pattern: /(基金份额累计净值|累计净值|累计单位净值|产品累计单位净值)[:：]?$/i, field: '累计净值' },
    { pattern: /(基金份额净值|单位净值|产品单位净值)[:：]?$/i, field: '单位净值' },
    { pattern: /(净值日期|日期|估值日期|统计日|份额最新变更日期)[:：]?$/i, field: '日期' },
    // 🚨 新增: 支持"持有产品份额"和"资产净值"
    { pattern: /(持有产品份额|产品份额|份额)[:：]?$/i, field: '份额' },
    { pattern: /(资产净值|基金资产净值)[:：]?$/i, field: '资产净值' },
  ];
  
  // 解析键值对
  const record: Record<string, string> = {};
  let lastKeyField: string | null = null;
  
  // 2列模式: 左侧字段名,右侧值
  if (maxCols === 2) {
    console.log('📋 检测到2列纵向表格模式');
    for (const row of data) {
      if (row.length < 2) continue;
      
      const keyCell = String(row[0] || '').trim();
      const valueCell = String(row[1] || '').trim();
      
      if (!keyCell || !valueCell || valueCell === '无') continue;
      
      // 匹配字段名
      for (const { pattern, field } of keyValuePatterns) {
        if (pattern.test(keyCell)) {
          record[field] = valueCell;
          console.log(`  ✅ ${keyCell} → ${field}: ${valueCell}`);
          break;
        }
      }
    }
  } else {
    // 1列或多列模式: 扁平单元格,需要智能识别
    console.log(`📋 检测到${maxCols}列表格,尝试扁平单元格模式`);
    
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      let matched = false;
      
      // 检查单元格是否包含冒号(键值在一起)
      const hasColon = cell.includes('：') || cell.includes(':');
      
      if (hasColon) {
        // 键值在一起: "净值日期：2026-07-31"
        const separator = cell.includes('：') ? '：' : ':';
        const parts = cell.split(separator);
        const key = parts[0].trim();
        let value = parts.slice(1).join(separator).trim();
        
        // 如果值为空,尝试下一个单元格
        if (!value && i + 1 < cells.length) {
          value = cells[i + 1].trim();
        }
        
        if (value && value !== '无') {
          // 匹配字段
          for (const { pattern, field } of keyValuePatterns) {
            if (pattern.test(key + '：' + value) || pattern.test(key + ':' + value)) {
              if (!record[field]) {
                record[field] = value;
                console.log(`  ✅ 扁平匹配: ${field} = ${value} (来自: "${key}")`);
              }
              matched = true;
              break;
            }
          }
        }
      }
      
      // 如果没有冒号,检查是否是纯键或纯值
      if (!matched) {
        for (const { pattern, field } of keyValuePatterns) {
          if (pattern.test(cell)) {
            lastKeyField = field;
            matched = true;
            console.log(`  🔍 找到键: ${field} (等待值...)`);
            break;
          }
        }
        
        // 如果上一个单元格是key,且当前单元格不是key,则当前是value
        if (!matched && lastKeyField && !record[lastKeyField]) {
          if (cell !== '无') {
            record[lastKeyField] = cell;
            console.log(`  ✅ 分离匹配: ${lastKeyField} = ${cell}`);
          }
          lastKeyField = null;
        }
      }
    }
  }
  
  console.log('📋 解析结果:', JSON.stringify(record));
  
  // 验证必需字段
  if (!record['产品代码'] || !record['单位净值'] || !record['日期']) {
    console.log('⚠️ 缺少必填字段:', {
      产品代码: record['产品代码'],
      单位净值: record['单位净值'],
      日期: record['日期'],
    });
    return null;
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
 * 策略3: 标准表头解析(使用第一行作为表头)
 */
function parseStandardHeader(data: any[][], sheetName: string): ParsedSheet | null {
  const headers = data[0].map((cell: any) => {
    if (cell && typeof cell === 'string') return cell.trim();
    if (cell !== null && cell !== undefined) return String(cell).trim();
    return '';
  });
  
  // 🚨 特殊处理: 如果表头只有"净值情况",需要从数据行中提取实际字段
  if (headers.length === 1 && headers[0] === '净值情况') {
    console.log('🔍 检测到"净值情况"单列表头,尝试从数据行提取字段');
    
    // 🚨 关键: 跳过第1行(表头说明行,如"单位净值"),从第2行开始查找真实数据
    for (let i = 2; i < data.length; i++) {
      const row = data[i] || [];
      const rowObj: Record<string, string> = {};
      
      // 🚨 关键修复: 这种Excel实际上是多列表格,但表头行只有1列("净值情况")
      // 需要使用启发式规则识别各列的含义
      row.forEach((cell: any, colIdx: number) => {
        if (cell !== null && cell !== undefined) {
          const cellStr = String(cell).trim();
          if (cellStr) {
            // 根据列索引和值的特征推断字段
            if (colIdx === 0) {
              // 第1列: 可能是产品名称/账套名称
              rowObj['productName'] = cellStr;
            } else if (colIdx === 1) {
              // 第2列: 可能是产品代码
              rowObj['productCode'] = cellStr;
            } else if (colIdx === 2) {
              // 第3列: 可能是日期
              rowObj['navDate'] = cellStr;
            } else if (colIdx >= 3) {
              // 第4列及以后: 可能是净值数据
              if (!rowObj['unitNav']) {
                rowObj['unitNav'] = cellStr;
              } else if (!rowObj['cumulativeNav']) {
                rowObj['cumulativeNav'] = cellStr;
              }
            }
          }
        }
      });
      
      // 如果这一行有"产品代码"等关键字段,说明是数据行
      if (rowObj['productCode'] && rowObj['unitNav']) {
        // 构建正确的行数据
        const cleanedRow: Record<string, string> = {};
        
        // 直接使用已映射的字段
        if (rowObj['productCode']) cleanedRow['productCode'] = rowObj['productCode'];
        if (rowObj['productName']) cleanedRow['productName'] = rowObj['productName'];
        if (rowObj['navDate']) cleanedRow['navDate'] = rowObj['navDate'];
        if (rowObj['unitNav']) cleanedRow['unitNav'] = rowObj['unitNav'];
        if (rowObj['cumulativeNav']) cleanedRow['cumulativeNav'] = rowObj['cumulativeNav'];
        
        console.log('✅ 从"净值情况"表格中提取到数据:', JSON.stringify(cleanedRow));
        return {
          sheetName,
          headers: Object.keys(cleanedRow),
          rows: [cleanedRow],  // 🚨 只返回1行真实数据
        };
      }
    }
    
    console.log('⚠️ 无法从"净值情况"表格中提取有效数据');
    return null;
  }
  
  // 🚨 过滤掉只有1个表头且是"净值情况"的情况(防止走到下面的标准处理)
  if (headers.length === 1 && headers[0] === '净值情况') {
    return null;
  }
  
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
 * 查找包含净值数据的Sheet - 增强版
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
