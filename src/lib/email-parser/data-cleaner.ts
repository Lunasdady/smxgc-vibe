import dayjs from 'dayjs';

export interface CleanedNavData {
  productCode: string;      // 产品代码（必填）
  productName: string;      // 产品名称（必填）
  navDate: string;          // 净值日期（必填）
  unitNav: number;          // 单位净值（必填，不再允许null）
  cumulativeNav: number;    // 累计净值（必填，不再允许null）
}

export interface DataQualityIssue {
  type: 'anomaly' | 'missing' | 'duplicate';
  message: string;
  data?: any;
}

/**
 * 清洗和验证净值数据
 */
export function cleanNavData(
  rawData: Record<string, string>
): { cleaned: CleanedNavData | null; issues: DataQualityIssue[] } {
  const issues: DataQualityIssue[] = [];
  
  // 提取字段
  let productCode = rawData.productCode?.trim() || '';
  const productName = rawData.productName?.trim() || '';
  const navDateStr = rawData.navDate?.trim() || '';
  const unitNavStr = rawData.unitNav?.trim() || '';
  const cumulativeNavStr = rawData.cumulativeNav?.trim() || '';
  
  // 🚨 修复: 清理产品代码后缀(如"SQU777_总层面" → "SQU777")
  if (productCode.includes('_')) {
    const originalCode = productCode;
    productCode = productCode.split('_')[0];
    console.log(`🧹 清理产品代码后缀: ${originalCode} → ${productCode}`);
  }
  
  // 🚨 优化: 降低必填字段要求 - 允许缺少productName
  if (!productCode) {
    issues.push({ type: 'missing', message: '缺少产品代码' });
    return { cleaned: null, issues };
  }
  
  // 🚨 修复: productName现在是必填字段（用户需求：5个指标都必须不为空）
  // 之前允许空值导致“净值成功落库”统计不准确
  if (!productName) {
    issues.push({ type: 'missing', message: '缺少产品名称' });
    return { cleaned: null, issues };
  }
  
  // 🚨 修复2: 检测productName是否被错误填充为邮件主题
  const subjectKeywords = ['【净值表】', '【净值自动发送】', '【净值公告】', '管理人旗下', '等', '个产品', '发送'];
  const isLikelySubject = subjectKeywords.some(kw => productName.includes(kw));
  
  if (isLikelySubject) {
    console.log(`⚠️ productName可能是邮件主题，拒绝保存: "${productName.substring(0, 50)}..."`);
    issues.push({ type: 'missing', message: '产品名称被错误填充为邮件主题' });
    return { cleaned: null, issues };
  }
  
  // 智能派生产品代码(处理母基金→子基金的情况)
  const derivedProductCode = deriveProductCode(productCode, productName);
  if (derivedProductCode !== productCode) {
    console.log(`🔄 产品代码派生: ${productCode} → ${derivedProductCode} (${productName})`);
  }
  
  // 解析日期 (增强版支持4种格式)
  const navDateResult = parseDateFlexible(navDateStr);
  if (!navDateResult) {
    issues.push({ type: 'missing', message: `日期格式无效: ${navDateStr}` });
    return { cleaned: null, issues };
  }
  const navDate = navDateResult;
  
  // 解析净值
  const unitNav = unitNavStr ? parseFloat(unitNavStr) : null;
  let cumulativeNav = cumulativeNavStr ? parseFloat(cumulativeNavStr) : null;
  
  // 🚨 修复: unitNav现在是必填字段（净值数据的核心）
  // 只有当unitNavStr存在但解析失败时才报错
  if (unitNavStr && (unitNav === null || isNaN(unitNav))) {
    issues.push({ type: 'missing', message: `单位净值无效: ${unitNavStr}` });
    return { cleaned: null, issues };
  }
  
  // 🚨 修复: unitNav为null视为数据不完整，拒绝保存
  // 之前允许空值导致44.84%的净值数据为空（88,987条）
  if (unitNav === null) {
    issues.push({ type: 'missing', message: '缺少单位净值' });
    return { cleaned: null, issues };
  }
  
  // 如果没有累计净值,使用单位净值作为累计净值(常见情况)
  if (cumulativeNav === null) {
    cumulativeNav = unitNav;
  }
  
  // 单位净值范围：0.1 - 100
  if (unitNav < 0.1 || unitNav > 100) {
    issues.push({
      type: 'anomaly',
      message: `单位净值超出正常范围(0.1-100): ${unitNav}`,
      data: { productCode, productName, navDate, unitNav },
    });
    // 不直接返回,只记录警告
  }
  
  // 累计净值范围：0.1 - 1000
  if (cumulativeNav < 0.1 || cumulativeNav > 1000) {
    issues.push({
      type: 'anomaly',
      message: `累计净值超出正常范围(0.1-1000): ${cumulativeNav}`,
      data: { productCode, productName, navDate, cumulativeNav },
    });
    // 不直接返回,只记录警告
  }
  
  return {
    cleaned: {
      productCode: derivedProductCode,
      productName,
      navDate,
      unitNav,
      cumulativeNav,
    },
    issues,
  };
}

/**
 * 智能派生产品代码(处理母基金→子基金的情况)
 * 
 * 行业惯例:
 * - 母基金: 量魁Alpha三号私募证券投资基金 → SSL379
 * - A类子基金: 量魁Alpha三号私募证券投资基金A → SL379A (去掉S,末尾加A)
 * - B类子基金: 量魁Alpha三号私募证券投资基金B → SL379B (去掉S,末尾加B)
 * - C类子基金: 量魁Alpha三号私募证券投资基金C → SL379C (以此类推)
 */
function deriveProductCode(productCode: string, productName: string): string {
  // 检查产品名称是否包含类剐标识(A类、B类、C类等)
  const classMatch = productName.match(/(私募证券投资基金)([A-Z])$/);
  
  if (classMatch) {
    const fundClass = classMatch[2]; // A, B, C, etc.
    
    // 如果产品代码以S开头且长度>=3,则进行派生
    if (productCode.startsWith('S') && productCode.length >= 3) {
      // 去掉首位S,末尾加上类剐标识
      const derivedCode = productCode.substring(1) + fundClass;
      return derivedCode;
    }
  }
  
  // 其他情况直接返回原产品代码
  return productCode;
}

/**
 * 检测净值异常波动(单日涨跌幅超过10%)
 */
export function detectAnomaly(
  currentNav: number,
  previousNav: number | null
): DataQualityIssue | null {
  if (!previousNav || previousNav === 0) {
    return null;
  }
  
  const changeRate = Math.abs((currentNav - previousNav) / previousNav);
  
  if (changeRate > 0.1) {
    return {
      type: 'anomaly',
      message: `净值异常波动: ${(changeRate * 100).toFixed(2)}%`,
      data: { currentNav, previousNav, changeRate },
    };
  }
  
  return null;
}

/**
 * 标准化日期格式
 */
export function normalizeDate(dateStr: string): string | null {
  try {
    const date = dayjs(dateStr);
    if (!date.isValid()) {
      return null;
    }
    return date.format('YYYY-MM-DD');
  } catch {
    return null;
  }
}

/**
 * 🚨 新增: 验证年份是否在合理范围内(1990-2100)
 * 防止Excel日期序列号被误解析为年份(如"4624")
 */
function isValidYear(year: number): boolean {
  return year >= 1990 && year <= 2100;
}

/**
 * 灵活解析日期(支持4种格式)
 * 🚨 增强: 添加年份范围验证，防止错误日期入库
 */
function parseDateFlexible(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  
  // 格式1: 2024-07-01
  let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    // 🚨 验证年份合理性
    if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn(`⚠️ 日期年份不合理: ${trimmed} (year=${year})`);
      return null;
    }
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  
  // 格式2: 2024/07/01
  match = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn(`⚠️ 日期年份不合理: ${trimmed} (year=${year})`);
      return null;
    }
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  
  // 格式3: 20240701
  match = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn(`⚠️ 日期年份不合理: ${trimmed} (year=${year})`);
      return null;
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  
  // 格式4: 2024年7月1日（中文日期格式）
  match = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn(`⚠️ 日期年份不合理: ${trimmed} (year=${year})`);
      return null;
    }
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  
  // 兜底: 使用dayjs解析
  try {
    const date = dayjs(trimmed);
    if (date.isValid()) {
      const year = date.year();
      if (!isValidYear(year)) {
        console.warn(`⚠️ 日期年份不合理: ${trimmed} (year=${year})`);
        return null;
      }
      return date.format('YYYY-MM-DD');
    }
  } catch {
    // ignore
  }
  
  return null;
}
