const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  // 验证300指增
  const data300 = await prisma.fundProduct.findMany({ 
    where: { dataDate: new Date('2026-07-08'), strategyType: 'index-enhanced-300' }, 
    take: 2 
  });
  console.log('=== 300指增（新字段）===');
  console.log('记录数:', data300.length);
  console.log('示例:', JSON.stringify(data300.map(d => ({
    product: d.productName,
    excessReturn1w: d.excessReturn1w,
    excessSharpeRatio: d.excessSharpeRatio
  })), null, 2));
  
  // 验证套利策略
  const arb = await prisma.fundProduct.findMany({ 
    where: { dataDate: new Date('2026-07-08'), strategyType: 'arbitrage' }, 
    take: 2 
  });
  console.log('\n=== 套利策略（新字段）===');
  console.log('记录数:', arb.length);
  console.log('示例:', JSON.stringify(arb.map(d => ({
    product: d.productName,
    excessReturn1w: d.excessReturn1w,
    karmaRatio: d.karmaRatio
  })), null, 2));
  
  // 验证主观多头（旧字段）
  const subjective = await prisma.fundProduct.findMany({ 
    where: { dataDate: new Date('2026-07-08'), strategyType: 'subjective-long' }, 
    take: 2 
  });
  console.log('\n=== 主观多头（旧字段）===');
  console.log('记录数:', subjective.length);
  console.log('示例:', JSON.stringify(subjective.map(d => ({
    product: d.productName,
    weeklyReturn: d.weeklyReturn,
    sharpeRatio: d.sharpeRatio
  })), null, 2));
  
  // 统计总数
  const total = await prisma.fundProduct.count({
    where: { dataDate: new Date('2026-07-08') }
  });
  console.log('\n📊 2026-07-08 总记录数:', total);
  
  await prisma.$disconnect();
}

verify().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
