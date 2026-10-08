/**
 * 收益指标计算工具
 * 用于从净值数据自动计算各类收益指标
 */

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

// 扩展dayjs功能
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/**
 * 计算区间收益率
 * @param startNav 期初净值
 * @param endNav 期末净值
 * @returns 收益率（百分比）
 */
export function calculateReturn(startNav: number, endNav: number): number {
  if (!startNav || !endNav || startNav === 0) {
    return 0;
  }
  return ((endNav - startNav) / startNav) * 100;
}

/**
 * 计算年化收益率
 * @param startNav 期初净值
 * @param endNav 期末净值
 * @param days 持有天数
 * @returns 年化收益率（百分比）
 */
export function calculateAnnualizedReturn(startNav: number, endNav: number, days: number): number {
  if (!startNav || !endNav || startNav === 0 || days === 0) {
    return 0;
  }
  const totalReturn = (endNav - startNav) / startNav;
  const annualizedReturn = Math.pow(1 + totalReturn, 365 / days) - 1;
  return annualizedReturn * 100;
}

/**
 * 计算最大回撤
 * @param navList 净值列表（按时间排序）
 * @returns 最大回撤（百分比）
 */
export function calculateMaxDrawdown(navList: number[]): number {
  if (!navList || navList.length < 2) {
    return 0;
  }

  let maxDrawdown = 0;
  let peak = navList[0];

  for (let i = 1; i < navList.length; i++) {
    const current = navList[i];
    
    // 更新峰值
    if (current > peak) {
      peak = current;
    }
    
    // 计算当前回撤
    const drawdown = (peak - current) / peak;
    
    // 更新最大回撤
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown * 100;
}

/**
 * 计算波动率（年化）
 * @param navList 净值列表（按时间排序）
 * @returns 年化波动率（百分比）
 */
export function calculateVolatility(navList: number[]): number {
  if (!navList || navList.length < 2) {
    return 0;
  }

  // 计算日收益率
  const dailyReturns: number[] = [];
  for (let i = 1; i < navList.length; i++) {
    const dailyReturn = (navList[i] - navList[i - 1]) / navList[i - 1];
    dailyReturns.push(dailyReturn);
  }

  // 计算平均收益率
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  // 计算方差
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;

  // 计算标准差（日波动率）
  const dailyVolatility = Math.sqrt(variance);

  // 年化波动率
  const annualizedVolatility = dailyVolatility * Math.sqrt(252);

  return annualizedVolatility * 100;
}

/**
 * 计算夏普比率
 * @param navList 净值列表（按时间排序）
 * @param riskFreeRate 无风险利率（年化，百分比）
 * @returns 夏普比率
 */
export function calculateSharpeRatio(navList: number[], riskFreeRate: number = 0): number {
  if (!navList || navList.length < 2) {
    return 0;
  }

  // 计算日收益率
  const dailyReturns: number[] = [];
  for (let i = 1; i < navList.length; i++) {
    const dailyReturn = (navList[i] - navList[i - 1]) / navList[i - 1];
    dailyReturns.push(dailyReturn);
  }

  // 计算平均收益率
  const meanReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  // 计算标准差
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return 0;
  }

  // 年化收益率
  const annualizedReturn = meanReturn * 252;
  const annualizedRiskFreeRate = riskFreeRate / 100 / 252;

  // 夏普比率
  const sharpeRatio = (annualizedReturn - annualizedRiskFreeRate) / stdDev;

  return sharpeRatio;
}

/**
 * 计算卡玛比率
 * @param navList 净值列表（按时间排序）
 * @returns 卡玛比率
 */
export function calculateKarmaRatio(navList: number[]): number {
  if (!navList || navList.length < 2) {
    return 0;
  }

  // 计算总收益率
  const totalReturn = (navList[navList.length - 1] - navList[0]) / navList[0];

  // 计算最大回撤
  const maxDrawdown = calculateMaxDrawdown(navList) / 100;

  if (maxDrawdown === 0) {
    return 0;
  }

  // 卡玛比率 = 年化收益率 / 最大回撤
  const days = navList.length; // 简化计算，假设每日一个净值
  const annualizedReturn = Math.pow(1 + totalReturn, 365 / days) - 1;

  return annualizedReturn / maxDrawdown;
}

/**
 * 查找指定日期前的净值
 * @param navData 净值数据列表（按日期排序）
 * @param targetDate 目标日期
 * @param daysAgo 往前推的天数
 * @returns 净值
 */
export function findNavByDate(navData: Array<{ navDate: Date | string; unitNav: number }>, targetDate: Date | string, daysAgo: number): number | null {
  const target = dayjs(targetDate).subtract(daysAgo, 'day');
  
  // 找到最接近目标日期的净值
  let closestNav = null;
  let minDiff = Infinity;

  for (const item of navData) {
    const diff = Math.abs(dayjs(item.navDate).diff(target, 'day'));
    if (diff < minDiff && dayjs(item.navDate).isSameOrBefore(target)) {
      minDiff = diff;
      closestNav = item.unitNav;
    }
  }

  return closestNav;
}

/**
 * 计算所有收益指标
 * @param navData 净值数据列表（按日期排序）
 * @param currentDate 当前日期
 * @returns 收益指标对象
 */
export function calculateAllMetrics(
  navData: Array<{ navDate: Date | string; unitNav: number }>,
  currentDate: Date | string
) {
  if (!navData || navData.length === 0) {
    return {
      weeklyReturn: null,
      monthlyReturn: null,
      ytdReturn: null,
      annualizedReturnSinceInception: null,
      ytdMaxDrawdown: null,
      inceptionMaxDrawdown: null,
      annualizedVolatility: null,
      sharpeRatio: null,
      karmaRatio: null,
    };
  }

  const currentNav = navData[navData.length - 1].unitNav;
  const startNav = navData[0].unitNav;
  const inceptionDays = dayjs(currentDate).diff(navData[0].navDate, 'day');

  // 近一周收益（7天）
  const nav1wAgo = findNavByDate(navData, currentDate, 7);
  const weeklyReturn = nav1wAgo ? calculateReturn(nav1wAgo, currentNav) : null;

  // 近一月收益（30天）
  const nav1mAgo = findNavByDate(navData, currentDate, 30);
  const monthlyReturn = nav1mAgo ? calculateReturn(nav1mAgo, currentNav) : null;

  // 今年以来收益
  const yearStart = dayjs(currentDate).startOf('year');
  const navYtdStart = navData.find(item => dayjs(item.navDate).isSameOrAfter(yearStart));
  const ytdReturn = navYtdStart ? calculateReturn(navYtdStart.unitNav, currentNav) : null;

  // 成立以来年化
  const annualizedReturnSinceInception = inceptionDays > 0 
    ? calculateAnnualizedReturn(startNav, currentNav, inceptionDays) 
    : null;

  // 今年最大回撤
  const ytdNavData = navData.filter(item => dayjs(item.navDate).isSameOrAfter(yearStart));
  const ytdMaxDrawdown = ytdNavData.length > 1 ? calculateMaxDrawdown(ytdNavData.map(item => item.unitNav)) : null;

  // 成立最大回撤
  const inceptionMaxDrawdown = navData.length > 1 ? calculateMaxDrawdown(navData.map(item => item.unitNav)) : null;

  // 年化波动率
  const annualizedVolatility = navData.length > 1 ? calculateVolatility(navData.map(item => item.unitNav)) : null;

  // 夏普比率
  const sharpeRatio = navData.length > 1 ? calculateSharpeRatio(navData.map(item => item.unitNav)) : null;

  // 卡玛比率
  const karmaRatio = navData.length > 1 ? calculateKarmaRatio(navData.map(item => item.unitNav)) : null;

  return {
    weeklyReturn,
    monthlyReturn,
    ytdReturn,
    annualizedReturnSinceInception,
    ytdMaxDrawdown,
    inceptionMaxDrawdown,
    annualizedVolatility,
    sharpeRatio,
    karmaRatio,
  };
}

/**
 * 计算超额收益指标
 * @param productNavData 产品净值数据
 * @param indexNavData 指数净值数据
 * @param currentDate 当前日期
 * @returns 超额收益指标对象
 */
export function calculateExcessMetrics(
  productNavData: Array<{ navDate: Date | string; unitNav: number }>,
  indexNavData: Array<{ navDate: Date | string; unitNav: number }>,
  currentDate: Date | string
) {
  // 计算产品收益指标
  const productMetrics = calculateAllMetrics(productNavData, currentDate);

  // 计算指数收益指标
  const indexMetrics = calculateAllMetrics(indexNavData, currentDate);

  // 计算超额收益
  return {
    excessReturn1w: productMetrics.weeklyReturn !== null && indexMetrics.weeklyReturn !== null
      ? productMetrics.weeklyReturn - indexMetrics.weeklyReturn
      : null,
    excessReturn3m: productMetrics.monthlyReturn !== null && indexMetrics.monthlyReturn !== null
      ? productMetrics.monthlyReturn - indexMetrics.monthlyReturn
      : null,
    excessReturnYtd: productMetrics.ytdReturn !== null && indexMetrics.ytdReturn !== null
      ? productMetrics.ytdReturn - indexMetrics.ytdReturn
      : null,
    excessAnnualizedReturn: productMetrics.annualizedReturnSinceInception !== null && indexMetrics.annualizedReturnSinceInception !== null
      ? productMetrics.annualizedReturnSinceInception - indexMetrics.annualizedReturnSinceInception
      : null,
    excessYtdMaxDrawdown: productMetrics.ytdMaxDrawdown !== null && indexMetrics.ytdMaxDrawdown !== null
      ? productMetrics.ytdMaxDrawdown - indexMetrics.ytdMaxDrawdown
      : null,
    excessInceptionMaxDrawdown: productMetrics.inceptionMaxDrawdown !== null && indexMetrics.inceptionMaxDrawdown !== null
      ? productMetrics.inceptionMaxDrawdown - indexMetrics.inceptionMaxDrawdown
      : null,
    excessAnnualizedVolatility: productMetrics.annualizedVolatility !== null && indexMetrics.annualizedVolatility !== null
      ? productMetrics.annualizedVolatility - indexMetrics.annualizedVolatility
      : null,
    excessSharpeRatio: productMetrics.sharpeRatio !== null && indexMetrics.sharpeRatio !== null
      ? productMetrics.sharpeRatio - indexMetrics.sharpeRatio
      : null,
  };
}
