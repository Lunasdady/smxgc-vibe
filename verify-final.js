const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  // 验证套利策略
  const arb = await prisma.fundProduct.findMany({ 
    where: { dataDate: new Date('2026-07-08'), strategyType: 'arbitrage' }, 
    take: 3 
  });
  console.log('=== 套利策略 ===');
  console.log('记录数:', arb.length);
  console.log('示例:', JSON.stringify(arb.map(d => ({
    product: d.productName,
    weeklyReturn: d.weeklyReturn,
    karmaRatio: d.karmaRatio
  })), null, 2));
  
  // 统计总数
  const total = await prisma.fundProduct.count({
    where: { dataDate: new Date('2026-07-08') }
  });
  console.log('\n📊 2026-07-08 总记录数:', total);
  
  // 各策略统计
  const byStrategy = await prisma.fundProduct.groupBy({
    by: ['strategyType'],
    where: { dataDate: new Date('2026-07-08') },
    _count: true
  });
  console.log('\n各策略记录数:');
  byStrategy.forEach(s => console.log(`  ${s.strategyType}: ${s._count}`));
  
  await prisma.$disconnect();
}

verify().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
