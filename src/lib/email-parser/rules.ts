import prisma from '@/lib/db';

/**
 * 非净值邮件过滤关键词 - 基于93,198封邮件验证
 */
const nonNavPatterns = [
  /退信/i,
  /bounce/i,
  /系统退信/i,
  /月报/i,
  /季报/i,
  /年报/i,
  /运行报告/i,
  /周报/i,
  /估值表/i,
  /分组清单/i,
  /私募星工厂/i,
  /合同变更/i,
  /重要事项提示/i,
  /portfolio.*valuation/i,
  /asset.*valuation/i,
  /\.pdf$/i  // PDF文件
];

/**
 * 检查邮件是否为净值邮件
 */
export function isNavEmail(subject: string): boolean {
  // 1. 先检查是否为非净值邮件
  for (const pattern of nonNavPatterns) {
    if (pattern.test(subject)) {
      return false;
    }
  }
  
  // 2. 检查是否为估值表(检查文件名和主题)
  if (isValuationEmail(subject)) {
    return false;
  }
  
  // 3. 如果包含净值相关关键词,则是净值邮件
  const navKeywords = ['净值', 'nav', '业绩', '单位净值', '资产净值'];
  return navKeywords.some(kw => subject.toLowerCase().includes(kw.toLowerCase()));
}

/**
 * 检查是否为估值表邮件
 */
function isValuationEmail(text: string): boolean {
  const valuationPatterns = [
    /估值表/i,
    /portfolio.*valuation/i,
    /asset.*valuation/i
  ];
  
  return valuationPatterns.some(pattern => pattern.test(text));
}

/**
 * 获取解析策略配置
 */
export async function getParseStrategy(): Promise<{
  htmlEnabled: boolean;
  excelEnabled: boolean;
  verticalEnabled: boolean;
  priority: 'html' | 'excel';
}> {
  const rules = await prisma.parseRule.findMany({
    where: {
      ruleType: 'parse_strategy',
      enabled: true,
    },
  });
  
  const config: {
    htmlEnabled: boolean;
    excelEnabled: boolean;
    verticalEnabled: boolean;
    priority: 'html' | 'excel';
  } = {
    htmlEnabled: true,
    excelEnabled: true,
    verticalEnabled: true,
    priority: 'excel',
  };
  
  for (const rule of rules) {
    switch (rule.ruleKey) {
      case 'html_enabled':
        config.htmlEnabled = rule.ruleValue === 'true';
        break;
      case 'excel_enabled':
        config.excelEnabled = rule.ruleValue === 'true';
        break;
      case 'vertical_enabled':
        config.verticalEnabled = rule.ruleValue === 'true';
        break;
      case 'priority':
        config.priority = rule.ruleValue as 'html' | 'excel';
        break;
    }
  }
  
  return config;
}

/**
 * 初始化默认解析规则
 */
export async function initDefaultRules(): Promise<void> {
  const existingCount = await prisma.parseRule.count();
  
  if (existingCount === 0) {
    const defaultRules = [
      { ruleType: 'parse_strategy', ruleKey: 'html_enabled', ruleValue: 'true' },
      { ruleType: 'parse_strategy', ruleKey: 'excel_enabled', ruleValue: 'true' },
      { ruleType: 'parse_strategy', ruleKey: 'vertical_enabled', ruleValue: 'true' },
      { ruleType: 'parse_strategy', ruleKey: 'priority', ruleValue: 'excel' },
    ];
    
    await prisma.parseRule.createMany({
      data: defaultRules,
    });
    
    console.log('✅ 已初始化默认解析规则');
  }
}
