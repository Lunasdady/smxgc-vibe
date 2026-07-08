const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

async function reimportArbitrage() {
  const filePath = path.join(__dirname, '私募星工厂全量私募业绩跟踪_20260708.xlsx');
  const dataDate = new Date('2026-07-08');
  
  console.log('🗑️  删除旧套利策略数据...');
  await prisma.fundProduct.deleteMany({
    where: { dataDate, strategyType: 'arbitrage' }
  });
  
  console.log('📂 读取 Excel 文件...');
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['套利策略'];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1 });
  const headers = data[0];
  const rows = data.slice(1).filter(row => row && row.some(cell => cell !== null));
  
  console.log(`📋 导入套利策略 ${rows.length} 条...`);
  console.log('列名:', headers);
  
  let imported = 0;
  
  for (const row of rows) {
    const rowObj = {};
    headers.forEach((header, i) => {
      if (header && typeof header === 'string') rowObj[header] = row[i];
    });
    
    if (!rowObj['产品名称']) continue;
    
    const productData = {
      dataDate,
      strategyType: 'arbitrage',
      fundManager: String(rowObj['基金管理人'] || ''),
      managerScale: String(rowObj['管理人规模'] || ''),
      isLargeScale: String(rowObj['管理人规模'] || '').includes('100亿'),
      productName: String(rowObj['产品名称'] || ''),
      strategyCategory: rowObj['策略分类'] ? String(rowObj['策略分类']) : null,
      // 套利策略：旧字段 + 卡玛比率
      weeklyReturn: parseDecimalNumber(rowObj['近一周收益']),
      monthlyReturn: parseDecimalNumber(rowObj['近一月收益']),
      ytdReturn: parseDecimalNumber(rowObj['今年以来收益']),
      annualizedReturnSinceInception: parseDecimalNumber(rowObj['成立以来年化收益']),
      ytdMaxDrawdown: parseDecimalNumber(rowObj['今年以来最大回撤']),
      inceptionMaxDrawdown: parseDecimalNumber(rowObj['成立以来最大回撤']),
      annualizedVolatility: parseDecimalNumber(rowObj['成立以来年化波动率']),
      karmaRatio: parseDecimalNumber(rowObj['成立以来卡玛比率']),
    };
    
    await prisma.fundProduct.create({ data: productData });
    imported++;
  }
  
  console.log(`✅ 成功导入 ${imported} 条套利策略`);
  await prisma.$disconnect();
}

function parseDecimalNumber(value) {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  if (Math.abs(num) < 1 && num !== 0) return num * 100;
  return num;
}

reimportArbitrage().catch(e => {
  console.error('导入失败:', e);
  prisma.$disconnect();
  process.exit(1);
});
