import { mapRowFields } from './field-mapper';

export interface ParsedVerticalData {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * 解析纵向表格(键值对格式)
 * 左列是字段名,右列是值
 */
export function parseVerticalTable(
  rawData: Record<string, string>[]
): ParsedVerticalData {
  const normalized: Record<string, string> = {};
  
  // 识别键值对
  for (const row of rawData) {
    const values = Object.values(row);
    if (values.length >= 2) {
      const key = String(values[0]).trim();
      const value = String(values[1]).trim();
      
      // 尝试标准化字段名
      const mapped = mapRowFields({ [key]: value });
      Object.assign(normalized, mapped);
    }
  }
  
  return {
    headers: Object.keys(normalized),
    rows: [normalized],
  };
}

/**
 * 检测是否为纵向表格
 * 特征:每行只有1-2列,第一列是字段名
 */
export function isVerticalTable(rows: Record<string, string>[]): boolean {
  if (rows.length < 3) return false;
  
  // 检查每行的列数
  const columnCounts = rows.map(row => Object.keys(row).length);
  const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
  
  // 如果平均列数接近2,可能是纵向表格
  return avgColumns >= 1.5 && avgColumns <= 2.5;
}
