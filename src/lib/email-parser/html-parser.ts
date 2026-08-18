import * as cheerio from 'cheerio';

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * 解析HTML中的表格
 */
export function parseHtmlTables(html: string): ParsedTable[] {
  const $ = cheerio.load(html);
  const tables: ParsedTable[] = [];
  
  $('table').each((_, element) => {
    const table = parseSingleTable($, element);
    if (table && table.rows.length > 0) {
      tables.push(table);
    }
  });
  
  return tables;
}

/**
 * 🚨 重写: 解析单个表格(支持标题行跳过、二级表头、colspan展开)
 */
function parseSingleTable($: cheerio.Root, table: cheerio.Element): ParsedTable | null {
  const allRows = $(table).find('tr');
  if (allRows.length === 0) {
    return null;
  }
  
  // 🚨 Step 1: 收集所有行的单元格信息(展开colspan)
  const rowInfos: { cells: string[]; isHeader: boolean }[] = [];
  
  allRows.each((_, row) => {
    const cells: string[] = [];
    // 🚨 修复: 使用children而不是find，避免递归查找嵌套表格的单元格
    $(row).children('th, td').each((_, cell) => {
      const text = $(cell).text().trim();
      const colspan = parseInt($(cell).attr('colspan') || '1', 10);
      // 展开colspan: 重复添加文本
      for (let i = 0; i < colspan; i++) {
        cells.push(text);
      }
    });
    
    const isHeader = $(row).find('th').length > 0 || $(row).closest('thead').length > 0;
    rowInfos.push({ cells, isHeader });
  });
  
  if (rowInfos.length === 0) {
    return null;
  }
  
  // 🚨 Step 2: 检测并跳过标题行(样本1: "日期：2024年07月01日")
  let headerStartIndex = 0;
  const firstRow = rowInfos[0];
  
  // 获取原始单元格数量(不考虑colspan展开)
  const firstRowOriginalCells = $(allRows[0]).children('th, td').length;
  
  // 如果第一行只有1个原始单元格，且包含"日期"、"净值"等标题关键词，则跳过
  // 即使这个单元格有colspan=5，展开后有5列，也认为是标题行
  if (firstRowOriginalCells === 1) {
    const titleKeywords = ['日期', '净值', '公告', '发送', '产品净值', '资产净值'];
    const firstCell = firstRow.cells[0];
    if (titleKeywords.some(kw => firstCell.includes(kw))) {
      console.log(`📋 跳过标题行: "${firstCell.substring(0, 30)}..."`);
      headerStartIndex = 1;
    }
  }
  
  // 🚨 Step 3: 检测二级表头(样本2: "净值情况" colspan=3)
  // 如果header行后面紧跟着的行的列数更多，说明有二级表头
  let headers: string[] = [];
  let dataStartIndex = headerStartIndex + 1;
  
  if (headerStartIndex < rowInfos.length) {
    const primaryHeaders = rowInfos[headerStartIndex].cells;
    
    // 检查是否有二级表头
    if (headerStartIndex + 1 < rowInfos.length) {
      const secondaryRow = rowInfos[headerStartIndex + 1];
      const secondaryCells = secondaryRow.cells;
      
      // 🚨 修复: 二级表头特征检测
      // 1. 第二行是th或thead中的tr
      // 2. 第二行列数 > 主表头列数
      // 3. 主表头中有空单元格(占位符)
      // 4. 🚨 新增: 第二行包含与主表头不同的非空内容（如“单位净值”、“累计单位净值”）
      const hasEmptyPrimary = primaryHeaders.some(h => h === '');
      const hasDifferentContent = secondaryCells.some((cell, idx) => {
        return cell !== '' && cell !== primaryHeaders[idx];
      });
      const isLikelySecondary = secondaryRow.isHeader || 
                                (secondaryCells.length > primaryHeaders.length) ||
                                hasEmptyPrimary ||
                                hasDifferentContent;
      
      if (isLikelySecondary && secondaryCells.length > 0) {
        console.log(`📋 检测到二级表头: 主表头=[${primaryHeaders.join(', ')}], 二级=[${secondaryCells.join(', ')}]`);
        
        // 🚨 修复: 合并主表头和二级表头
        // 策略:
        // 1. 如果二级表头非空，优先使用二级表头
        // 2. 如果二级表头为空但主表头非空，使用主表头
        // 3. 如果主表头是通用词汇(如"净值情况")，使用对应的二级表头
        for (let i = 0; i < primaryHeaders.length; i++) {
          const primary = primaryHeaders[i];
          const secondary = secondaryCells[i] || '';  // 🚨 直接使用相同索引
          
          // 如果二级表头非空
          if (secondary !== '') {
            // 🚨 特殊处理: 如果主表头是通用词汇，直接使用二级表头
            const genericHeaders = ['净值情况', '净值', '操作', '状态', '信息'];
            if (primary === '' || genericHeaders.some(g => primary.includes(g))) {
              headers.push(secondary);
            } else {
              // 组合主表头和二级表头
              headers.push(`${primary}-${secondary}`);
            }
          } else if (primary !== '') {
            // 二级表头为空，使用主表头
            headers.push(primary);
          }
          // 如果都为空，不添加
        }
        
        dataStartIndex = headerStartIndex + 2;
        console.log(`📋 合并后表头: [${headers.join(', ')}]`);
      } else {
        headers = primaryHeaders;
      }
    } else {
      headers = primaryHeaders;
    }
  }
  
  if (headers.length === 0) {
    return null;
  }
  
  // 🚨 Step 4: 解析数据行
  const rows: Record<string, string>[] = [];
  
  for (let i = dataStartIndex; i < rowInfos.length; i++) {
    const rowInfo = rowInfos[i];
    const rowData: Record<string, string> = {};
    
    for (let j = 0; j < Math.min(rowInfo.cells.length, headers.length); j++) {
      const value = rowInfo.cells[j];
      if (value !== '') {
        rowData[headers[j]] = value;
      }
    }
    
    // 只添加包含有效数据的行
    if (Object.keys(rowData).length > 0) {
      rows.push(rowData);
    }
  }
  
  console.log(`📋 表格解析结果: ${headers.length}列, ${rows.length}行数据`);
  
  return { headers, rows };
}

/**
 * 查找包含净值数据的表格
 */
export function findNavTable(tables: ParsedTable[]): ParsedTable | null {
  const navKeywords = ['单位净值', '累计净值', '净值日期', '产品代码', '产品名称', '净值'];
  
  let bestTable: ParsedTable | null = null;
  let bestScore = 0;
  
  for (const table of tables) {
    const headerText = table.headers.join(' ');
    const matchCount = navKeywords.filter(kw => headerText.includes(kw)).length;
    
    console.log(`📋 检查HTML表格: 表头=[${headerText}], 匹配数=${matchCount}`);
    
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestTable = table;
    }
  }
  
  // 降低阈值到1个关键词(只要有"净值"就可能)
  if (bestScore >= 1 && bestTable) {
    console.log(`✅ 找到净值HTML表格,匹配数=${bestScore}`);
    
    // 🚨 特殊检查: 如果是1列表格,且表头是标题类词汇(不是净值字段),则返回null
    // 这种情况应该使用纵向解析器(parseHtmlKeyValue)
    if (bestTable.headers.length === 1) {
      const titleKeywords = ['资产净值公告', '净值公告', '基金净值', '公告', '专用表', '资产净值表'];
      const isTitle = titleKeywords.some(kw => bestTable.headers[0].includes(kw));
      
      if (isTitle) {
        console.log(`⚠️ 表格是标题类(1列,表头="${bestTable.headers[0]}"),跳过横向解析,留给纵向解析器`);
        return null;
      }
    }
    
    return bestTable;
  }
  
  console.log(`⚠️ 未找到净值HTML表格`);
  return null;
}

/**
 * 解析HTML正文中的纵向键值对(用于资产净值公告类邮件)
 * 
 * 支持3种格式:
 * 1. 标准格式: "净值日期：2026-07-31" (键值在同一文本节点)
 * 2. 单元格分离: <td>基金代码：</td><td>SXR127</td> (键值在不同单元格)
 * 3. 混合格式: 部分键值在一起,部分分开
 * 
 * 示例格式:
 * 净值日期：2026-07-31
 * 基金代码：	SAUL40
 * 基金名称：	海晟领航1号私募证券投资基金
 * 基金份额净值：	0.8894
 * 基金份额累计净值：	1.2894
 */
export function parseHtmlKeyValue(html: string): Record<string, string> | null {
  const $ = cheerio.load(html);
  const record: Record<string, string> = {};
  
  // 字段映射规则(用于正则匹配)
  const fieldPatterns: { pattern: RegExp; field: string }[] = [
    // 🚨 修复: 支持中文日期格式 "2024年07月01日" 和标准格式 "2024-07-01"
    { pattern: /(净值日期|日期|统计日|估值日期)[：:\s]*([\d]{4}年[\d]{1,2}月[\d]{1,2}日|[\d]{4}-[\d]{1,2}-[\d]{1,2})/i, field: '日期' },
    { pattern: /(基金代码|产品代码|代码|协会备案代码)[：:\s]*([A-Za-z0-9]{4,})/i, field: '产品代码' },  // 🚨 产品代码至少4位
    { pattern: /(基金名称|产品名称|名称)[：:\s]*([^：:\n\r\t]{2,50})/i, field: '产品名称' },  // 🚨 排除冒号,避免匹配"总资产净值:xxx"
    { pattern: /(基金份额净值|单位净值|产品单位净值)[：:\s]*([\d.]+)/i, field: '单位净值' },  // 🚨 排除单独的"净值"
    { pattern: /(基金份额累计净值|累计净值|累计单位净值|产品累计单位净值)[：:\s]*([\d.]+)/i, field: '累计净值' },
  ];
  
  // 方法1: 尝试从完整文本中用正则匹配(标准格式)
  const text = $('body').text();
  
  for (const { pattern, field } of fieldPatterns) {
    const match = text.match(pattern);
    if (match && match[2]) {
      const value = match[2].trim();
      if (value && value !== '无') {
        record[field] = value;
        console.log(`  ✅ HTML标准匹配: ${field} = ${value}`);
      }
    }
  }
  
  // 🚨 过滤掉明显错误的匹配
  if (record['产品名称'] && /总资产净值|资产净值|累计净值|单位净值|基金净值/i.test(record['产品名称'])) {
    console.log(`  ⚠️ 产品名称匹配错误(${record['产品名称']}),已清除`);
    delete record['产品名称'];
  }
  
  if (record['单位净值'] && /^20\d{2}$/.test(record['单位净值'])) {
    console.log(`  ⚠️ 单位净值匹配错误(${record['单位净值']}),已清除`);
    delete record['单位净值'];
  }
  
  // 方法2: 如果标准匹配缺少字段,尝试单元格分离模式
  const hasAllFields = record['产品代码'] && record['单位净值'] && record['日期'];
  
  if (!hasAllFields) {
    console.log('  ⚠️ 标准匹配不完整,尝试单元格分离模式...');
    
    // 提取所有单元格
    const cells: string[] = [];
    $('td, th').each((_, cell) => {
      cells.push($(cell).text().trim());
    });
    
    console.log(`  📊 找到 ${cells.length} 个单元格`);
    
    // 遍历单元格,查找键值对
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      
      // 检查是否包含冒号
      if (cell.includes('：') || cell.includes(':')) {
        const separator = cell.includes('：') ? '：' : ':';
        const parts = cell.split(separator);
        const key = parts[0].trim();
        let value = parts.slice(1).join(separator).trim();
        
        // 如果值为空,尝试从下一个单元格获取
        if (!value && i + 1 < cells.length) {
          value = cells[i + 1].trim();
        }
        
        if (value && value !== '无') {
          // 匹配字段
          for (const { pattern, field } of fieldPatterns) {
            if (pattern.test(key + '：' + value) || pattern.test(key + ':' + value)) {
              if (!record[field]) { // 只在字段缺失时填充
                record[field] = value;
                console.log(`  ✅ 单元格匹配: ${field} = ${value} (来自: "${key}")`);
              }
              break;
            }
          }
        }
      }
    }
  }
  
  // 验证必需字段
  if (record['产品代码'] && record['单位净值'] && record['日期']) {
    console.log('✅ HTML纵向解析成功');
    return record;
  }
  
  console.log('⚠️ HTML纵向解析失败,缺少必填字段:', {
    产品代码: record['产品代码'],
    单位净值: record['单位净值'],
    日期: record['日期'],
  });
  
  return null;
}
