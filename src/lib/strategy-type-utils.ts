/**
 * 根据一级和二级策略名称，自动判断策略类型
 */
export function getStrategyType(primaryStrategy: string, secondaryStrategy: string): string {
  const ps = primaryStrategy || '';
  const ss = secondaryStrategy || '';

  // 指增策略
  if (ps.includes('指增')) {
    if (ss.includes('300')) return 'index-enhanced-300';
    if (ss.includes('500') && !ss.includes('A500')) return 'index-enhanced-500';
    if (ss.includes('1000')) return 'index-enhanced-1000';
    if (ss.includes('2000')) return 'index-enhanced-2000';
    if (ss.includes('另类') || ss.includes('红利') || ss.includes('A500')) return 'index-enhanced-alternative';
    return 'index-enhanced-500';
  }

  // 主观多头
  if (ps.includes('主观多头') || ss.includes('主观多头')) return 'subjective-long';

  // 量化选股
  if (ps.includes('量化选股') || ss.includes('量化选股')) return 'quantitative-stock-selection';

  // 择时&多空
  if (ps.includes('择时') || ps.includes('多空') || ss.includes('择时') || ss.includes('多空')) return 'timing-long-short';

  // 市场中性&T0
  if (ps.includes('市场中性') || ps.includes('T0') || ss.includes('市场中性') || ss.includes('T0')) return 'market-neutral-t0';

  // 可转债多头
  if (ps.includes('可转债') || ss.includes('可转债')) return 'convertible-bond-long';

  // 套利策略
  if (ps.includes('套利') || ss.includes('套利') || ss.includes('ETF')) return 'arbitrage';

  // 宏观策略
  if (ps.includes('宏观') || ss.includes('宏观')) return 'macro-strategy';

  // 复合策略
  if (ps.includes('复合') || ss.includes('复合')) return 'composite-strategy';

  // CTA策略
  if (ps.includes('CTA') || ss.includes('CTA')) {
    if (ps.includes('主观') || ss.includes('主观')) return 'subjective-cta';
    if (ps.includes('量化') || ss.includes('量化')) return 'quantitative-cta';
    if (ps.includes('复合') || ss.includes('复合')) return 'composite-cta';
    return 'quantitative-cta';
  }

  // 强势股
  if (ps.includes('强势股') || ss.includes('强势股')) return 'strong-stock';

  // 默认返回空字符串
  return '';
}
