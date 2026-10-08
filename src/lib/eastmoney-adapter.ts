/**
 * 东方财富指数数据适配器
 * 
 * 使用东方财富免费API获取指数数据
 * API文档: https://push2.eastmoney.com/api/qt/stock/kline/get
 * 
 * 支持的指数代码映射:
 * - 沪深300: 1.000300
 * - 中证500: 1.000905
 * - 中证1000: 1.000852
 * - 中证2000: 0.932000
 * - 科创50: 0.000688
 */

interface IndexDataPoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  change: number;
  changePercent: number;
  turnover: number;
}

interface EastMoneyResponse {
  data: {
    klines: string[]; // 格式: "2024-01-01,1234.56,1240.00,1230.00,1235.00,1000000,123456789,1.23,1.25,0.5"
  };
  rc: number;
  rt: number;
  svr: number;
  lt: number;
  full: number;
  rl: number;
  s: string;
}

/**
 * 指数代码映射表
 * 标准代码 -> 东方财富代码
 */
const INDEX_CODE_MAP: Record<string, string> = {
  '000300.SH': '1.000300',  // 沪深300
  '000905.SH': '1.000905',  // 中证500
  '000852.SH': '1.000852',  // 中证1000
  '932000.SH': '0.932000',  // 中证2000
  '000688.SH': '0.000688',  // 科创50
};

/**
 * 获取东方财富指数代码
 */
export function getEastMoneyCode(indexCode: string): string {
  const eastMoneyCode = INDEX_CODE_MAP[indexCode];
  if (!eastMoneyCode) {
    throw new Error(`不支持的指数代码: ${indexCode}`);
  }
  return eastMoneyCode;
}

/**
 * 从东方财富API获取指数K线数据
 * 
 * @param indexCode 指数代码（标准格式，如 000300.SH）
 * @param startDate 开始日期（YYYY-MM-DD）
 * @param endDate 结束日期（YYYY-MM-DD）
 * @param klt K线周期（101=日K）
 * @returns 指数数据点数组
 */
export async function fetchIndexDataFromEastMoney(
  indexCode: string,
  startDate: string,
  endDate: string,
  klt: number = 101
): Promise<IndexDataPoint[]> {
  const eastMoneyCode = getEastMoneyCode(indexCode);
  
  // 构建东方财富API URL
  const url = new URL('https://push2.eastmoney.com/api/qt/stock/kline/get');
  url.searchParams.set('secid', eastMoneyCode);
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbbd1');
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61');
  url.searchParams.set('klt', String(klt)); // 101=日K
  url.searchParams.set('fqt', '1'); // 前复权
  url.searchParams.set('beg', startDate.replace(/-/g, ''));
  url.searchParams.set('end', endDate.replace(/-/g, ''));
  url.searchParams.set('lmt', '1000'); // 限制返回条数
  url.searchParams.set('_', String(Date.now()));

  console.log(`[EastMoney] 请求URL: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: EastMoneyResponse = await response.json();

    // 检查返回状态
    if (data.rc !== 0) {
      throw new Error(`东方财富API返回错误码: ${data.rc}`);
    }

    // 检查是否有数据
    if (!data.data?.klines || data.data.klines.length === 0) {
      console.log(`[EastMoney] 无数据: ${indexCode} (${startDate} ~ ${endDate})`);
      return [];
    }

    console.log(`[EastMoney] 获取到 ${data.data.klines.length} 条数据`);

    // 解析K线数据
    const result: IndexDataPoint[] = data.data.klines.map((line: string) => {
      const parts = line.split(',');
      return {
        date: parts[0],
        open: parseFloat(parts[1]) || 0,
        close: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[3]) || 0,
        low: parseFloat(parts[4]) || 0,
        volume: parseFloat(parts[5]) || 0,
        amount: parseFloat(parts[6]) || 0,
        change: parseFloat(parts[7]) || 0,
        changePercent: parseFloat(parts[8]) || 0,
        turnover: parseFloat(parts[9]) || 0,
      };
    });

    return result;
  } catch (error) {
    console.error(`[EastMoney] 获取数据失败:`, error);
    throw error;
  }
}

/**
 * 批量获取多个指数的数据
 * 
 * @param indexCodes 指数代码数组
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 所有指数的数据（按指数代码分组）
 */
export async function fetchMultipleIndexData(
  indexCodes: string[],
  startDate: string,
  endDate: string
): Promise<Record<string, IndexDataPoint[]>> {
  const results: Record<string, IndexDataPoint[]> = {};

  // 串行获取，避免并发过多请求
  for (const indexCode of indexCodes) {
    try {
      console.log(`[EastMoney] 开始获取: ${indexCode}`);
      const data = await fetchIndexDataFromEastMoney(indexCode, startDate, endDate);
      results[indexCode] = data;
      console.log(`[EastMoney] 完成获取: ${indexCode} (${data.length}条)`);
      
      // 请求间隔，避免频率限制
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[EastMoney] 获取失败: ${indexCode}`, error);
      results[indexCode] = [];
    }
  }

  return results;
}

/**
 * 计算日收益率
 */
export function calculateDailyReturn(
  currentClose: number,
  previousClose: number
): number {
  if (previousClose === 0) return 0;
  return ((currentClose - previousClose) / previousClose) * 100;
}

/**
 * 转换东方财富数据为数据库格式
 */
export function convertToDatabaseFormat(
  indexCode: string,
  data: IndexDataPoint[]
): Array<{
  indexCode: string;
  indexName: string;
  tradeDate: Date;
  closePrice: number;
  dailyReturn: number | null;
}> {
  const indexName = getIndexName(indexCode);
  const result: Array<{
    indexCode: string;
    indexName: string;
    tradeDate: Date;
    closePrice: number;
    dailyReturn: number | null;
  }> = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const previousClose = i > 0 ? data[i - 1].close : null;
    
    const dailyReturn = previousClose
      ? calculateDailyReturn(item.close, previousClose)
      : null;

    result.push({
      indexCode,
      indexName,
      tradeDate: new Date(item.date),
      closePrice: item.close,
      dailyReturn: dailyReturn !== null ? Math.round(dailyReturn * 10000) / 10000 : null,
    });
  }

  return result;
}

/**
 * 获取指数名称
 */
export function getIndexName(indexCode: string): string {
  const nameMap: Record<string, string> = {
    '000300.SH': '沪深300',
    '000905.SH': '中证500',
    '000852.SH': '中证1000',
    '932000.SH': '中证2000',
    '000688.SH': '科创50',
  };
  return nameMap[indexCode] || indexCode;
}
