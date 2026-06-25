import { FiveNumberStats } from './types';

/**
 * 计算五数统计（最小值、Q25、均值、Q75、最大值）
 */
export function calculateFiveNumberStats(
  values: number[]
): FiveNumberStats {
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      q25: null,
      mean: null,
      q75: null,
      max: null,
    };
  }

  // 过滤掉 null 和 undefined
  const validValues = values.filter((v) => v !== null && v !== undefined);

  if (validValues.length === 0) {
    return {
      count: 0,
      min: null,
      q25: null,
      mean: null,
      q75: null,
      max: null,
    };
  }

  // 排序
  const sorted = [...validValues].sort((a, b) => a - b);
  const count = sorted.length;

  // 最小值和最大值
  const min = sorted[0];
  const max = sorted[count - 1];

  // 计算分位数
  const q25 = percentile(sorted, 25);
  const q75 = percentile(sorted, 75);

  // 计算均值
  const mean = sorted.reduce((sum, val) => sum + val, 0) / count;

  return {
    count,
    min,
    q25,
    mean,
    q75,
    max,
  };
}

/**
 * 计算百分位数
 */
function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * 格式化百分比显示
 */
export function formatPercentage(value: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${value.toFixed(2)}%`;
}

/**
 * 从文件名提取数据日期
 */
export function extractDataDateFromFilename(filename: string): string | null {
  // 支持 .xlsx 和 .csv 格式
  const match = filename.match(/_(\d{8})\.(xlsx|xls|csv)$/i);
  if (match) {
    const dateStr = match[1];
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return null;
}
