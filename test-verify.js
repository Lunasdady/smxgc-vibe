const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const arb = await prisma.fundProduct.findMany({ 
    where: { dataDate: new Date('2026-07-08'), strategyType: 'arbitrage' }, 
    take: 3 
  });
  console.log('套利策略记录数:', arb.length);
  console.log('示例:', JSON.stringify(arb.map(d => ({
    product: d.productName,
    weeklyReturn: d.weeklyReturn,
    karmaRatio: d.karmaRatio
  })), null, 2));
  
  const total = await prisma.fundProduct.count({
    where: { dataDate: new Date('2026-07-08') }
  });
  console.log('总记录数:', total);
  
  await prisma.$disconnect();
}

verify().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
