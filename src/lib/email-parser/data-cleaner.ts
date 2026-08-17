import dayjs from 'dayjs';

export interface CleanedNavData {
  productCode: string;
  productName: string;
  navDate: string;
  unitNav: number | null;
  cumulativeNav: number | null;
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
  
  // 🚨 优化: productName不再是必填(很多邮件没有产品名称)
  // if (!productName) {
  //   issues.push({ type: 'missing', message: '缺少产品名称' });
  //   return { cleaned: null, issues };
  // }
  
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
  const unitNav = parseFloat(unitNavStr);
  let cumulativeNav = cumulativeNavStr ? parseFloat(cumulativeNavStr) : null;
  
  // 如果没有累计净值,使用单位净值作为累计净值(常见情况)
  if (cumulativeNav === null && !isNaN(unitNav)) {
    cumulativeNav = unitNav;
  }
  
  // 验证净值范围 (增强版)
  if (isNaN(unitNav)) {
    issues.push({ type: 'missing', message: `单位净值无效: ${unitNavStr}` });
    return { cleaned: null, issues };
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
  if (cumulativeNav !== null && (cumulativeNav < 0.1 || cumulativeNav > 1000)) {
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
 * 灵活解析日期(支持4种格式)
 */
function parseDateFlexible(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  
  // 格式1: 2024-07-01
  let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 格式2: 2024/07/01
  match = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 格式3: 20240701
  match = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    const year = match[1];
    const month = match[2];
    const day = match[3];
    return `${year}-${month}-${day}`;
  }
  
  // 格式4: 2024年7月1日
  match = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 兜底: 使用dayjs解析
  try {
    const date = dayjs(trimmed);
    if (date.isValid()) {
      return date.format('YYYY-MM-DD');
    }
  } catch {
    // ignore
  }
  
  return null;
}
