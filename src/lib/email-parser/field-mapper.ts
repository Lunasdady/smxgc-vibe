/**
 * 字段别名映射 - 基于93,198封邮件实战验证
 */
export const FIELD_ALIASES: Record<string, string> = {
  // === 日期字段
  '份额最新变更日期': 'navDate',
  '报表出具日期': 'navDate',
  '估值基准日': 'navDate',
  '日期': 'navDate',
  '净值日期': 'navDate',
  '统计日': 'navDate',
  '数据日期': 'navDate',
  '估值日期': 'navDate',
  'Date': 'navDate',
  'NAV Date': 'navDate',
  'Valuation Date': 'navDate',
  'Trade Date': 'navDate',
  '净值日': 'navDate',
  '基准日': 'navDate',
  '交易日': 'navDate',
  '日期：': 'navDate',
  '净值日期：': 'navDate',
  
  // === 产品代码字段 (21个别名) ===
  '产品代码': 'productCode',
  '基金代码': 'productCode',
  '资产代码': 'productCode',
  '代码': 'productCode',
  '产品编号': 'productCode',
  '基金编号': 'productCode',
  'Product Code': 'productCode',
  'Fund Code': 'productCode',
  'Code': 'productCode',
  'Symbol': 'productCode',
  '产品编码': 'productCode',
  '基金编码': 'productCode',
  '证券代码': 'productCode',
  '产品代码：': 'productCode',
  '基金代码：': 'productCode',
  '备案编码': 'productCode',
  '协会备案编码': 'productCode',
  
  // === 产品名称字段 (15个别名) ===
  '产品名称': 'productName',
  '基金名称': 'productName',
  '资产名称': 'productName',
  '名称': 'productName',
  '产品全称': 'productName',
  '基金全称': 'productName',
  'Product Name': 'productName',
  'Fund Name': 'productName',
  'Name': 'productName',
  '证券名称': 'productName',
  '账套名称': 'productName',
  '基金名称：': 'productName',
  '产品名称：': 'productName',
  
  // === 单位净值字段 (14个别名) ===
  '单位净值': 'unitNav',
  '净值': 'unitNav',
  '单位累计净值': 'unitNav',
  '份额净值': 'unitNav',
  '资产份额净值(元)': 'unitNav',
  'NAV': 'unitNav',
  'Unit NAV': 'unitNav',
  'Net Asset Value': 'unitNav',
  '单位资产净值': 'unitNav',
  '每份净值': 'unitNav',
  '单位净值：': 'unitNav',
  '净值情况': 'unitNav',  // 🚨 SVU833等特殊表格
  
  // === 累计净值字段 (11个别名) ===
  '累计净值': 'cumulativeNav',
  '累计单位净值': 'cumulativeNav',
  '复权净值': 'cumulativeNav',
  '资产份额累计净值(元)': 'cumulativeNav',
  'ACC NAV': 'cumulativeNav',
  'Accumulated NAV': 'cumulativeNav',
  'Cumulative NAV': 'cumulativeNav',
  '累计资产净值': 'cumulativeNav',
  '累计净值：': 'cumulativeNav',
  '累计单位净值：': 'cumulativeNav',
  '累积净值': 'cumulativeNav',
};

/**
 * 券商模板配置
 */
export const BROKER_TEMPLATES: Record<string, string[]> = {
  '兴业证券': ['单位净值', '累计净值', '产品代码', '产品名称', '净值日期'],
  '中信建投': ['净值日期', '基金代码', '基金名称', '单位净值', '累计净值'],
  '国泰君安': ['产品代码', '产品名称', '净值日期', '单位净值', '累计净值'],
};

/**
 * 标准化字段名 - 增强版支持2级表头和复合格式
 */
export function normalizeFieldName(fieldName: string): string | null {
  const trimmed = fieldName.trim();
  
  // 1. 直接匹配
  if (FIELD_ALIASES[trimmed]) {
    return FIELD_ALIASES[trimmed];
  }
  
  // 2. 处理2级表头格式: "基金代码-资产净值" 或 "净值情况-单位净值"
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    // 尝试匹配每个部分
    for (const part of parts) {
      const normalized = normalizeSimpleField(part.trim());
      if (normalized) return normalized;
    }
  }
  
  // 3. 处理包含数值的表头: "单位净值：2.7289-市值"
  const cleaned = trimmed.replace(/[：:][\d.]+.*/, '').trim();
  if (cleaned !== trimmed) {
    const normalized = normalizeSimpleField(cleaned);
    if (normalized) return normalized;
  }
  
  // 4. 处理复合格式: "代码 | 产品代码"
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    for (const part of parts) {
      const normalized = normalizeSimpleField(part.trim());
      if (normalized) return normalized;
    }
  }
  
  // 5. 模糊匹配(包含关键词)
  return normalizeSimpleField(trimmed);
}

/**
 * 简单字段匹配(不含特殊格式)
 */
function normalizeSimpleField(fieldName: string): string | null {
  const trimmed = fieldName.trim();
  
  // 🚨 关键: 清理换行符和括号内的英文
  // 例如: "日期\n（NAV As Of Date）" → "日期"
  // 例如: "单位净值\n（NAV/Share）" → "单位净值"
  let cleaned = trimmed;
  
  // 1. 去除换行符及之后的内容
  if (cleaned.includes('\n')) {
    cleaned = cleaned.split('\n')[0].trim();
  }
  
  // 2. 去除括号内的内容(包括中英文括号)
  cleaned = cleaned.replace(/[（(].*?[）)]/g, '').trim();
  
  // 🚨 排除明显不是净值字段的词汇
  const excludeKeywords = ['净值情况', '情况', '浏览表', '专用表', '账套名称', '声明', '备注', '资产净值', '资产份额'];
  if (excludeKeywords.some(kw => cleaned.includes(kw))) {
    return null;
  }
  
  // 直接匹配(使用清理后的字段名)
  if (FIELD_ALIASES[cleaned]) {
    return FIELD_ALIASES[cleaned];
  }
  
  // 模糊匹配(包含关键词) - 但要排除明显不匹配的情况
  for (const [alias, standard] of Object.entries(FIELD_ALIASES)) {
    // 🚨 排除规则: 如果字段名比别名长很多,且包含不同的关键词,不要匹配
    // 例如: "协会备案代码"不应该匹配到"代码"
    if (cleaned.length > alias.length + 2) {
      // 检查cleaned是否包含alias作为完整词(而不是部分)
      const hasCompleteMatch = cleaned.includes(alias) && 
        !cleaned.replace(alias, '').match(/代码|名称|净值|日期/); // 移除alias后不应再包含这些关键词
      
      if (!hasCompleteMatch) {
        continue; // 跳过这个别名
      }
    }
    
    if (cleaned.includes(alias) || alias.includes(cleaned)) {
      return standard;
    }
  }
  
  return null;
}

/**
 * 映射数据行的字段名
 */
export function mapRowFields(row: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  
  // 🚨 定义字段优先级: productCode > productName > unitNav > cumulativeNav > navDate
  // 优先级高的字段一旦映射,就不能被优先级低的覆盖
  const fieldPriority: Record<string, number> = {
    productCode: 5,
    productName: 4,
    unitNav: 3,
    cumulativeNav: 2,
    navDate: 1,
  };
  
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeFieldName(key);
    if (normalized) {
      // 检查是否已有映射,如果有,比较优先级
      if (mapped[normalized]) {
        const existingPriority = fieldPriority[normalized] || 0;
        const newPriority = fieldPriority[normalized] || 0;
        
        // 只在新字段优先级更高时才覆盖
        // (这里的优先级是相同的,所以不覆盖,保留第一个)
        if (existingPriority >= newPriority) {
          console.log(`⚠️ 字段冲突: "${key}" → ${normalized}, 已存在,保留第一个`);
          continue;
        }
      }
      
      mapped[normalized] = value;
    }
  }
  
  return mapped;
}

/**
 * 识别邮件来源券商
 */
export function identifyBroker(subject: string, fromEmail: string): string | null {
  const text = `${subject} ${fromEmail}`.toLowerCase();
  
  for (const broker of Object.keys(BROKER_TEMPLATES)) {
    if (text.includes(broker.toLowerCase())) {
      return broker;
    }
  }
  
  return null;
}
