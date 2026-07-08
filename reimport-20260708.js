const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

// 策略类型映射
const STRATEGY_MAP = {
  '主观多头': 'subjective-long',
  '300指增': 'index-enhanced-300',
  '500指增': 'index-enhanced-500',
  '1000指增': 'index-enhanced-1000',
  '2000指增': 'index-enhanced-2000',
  '另类指增': 'index-enhanced-alternative',
  '量化选股': 'quantitative-stock-selection',
  '择时&多空': 'timing-long-short',
  '市场中性&T0': 'market-neutral-t0',
  '可转债多头': 'convertible-bond-long',
  '主观CTA': 'subjective-futures',
  '量化CTA': 'quantitative-futures',
  '复合CTA': 'quantitative-futures',
  '套利策略': 'arbitrage',
  '宏观策略': 'macro-strategy',
  '复合策略': 'composite-strategy',
  '强势股': 'strong-stock',
};

// 解析小数
function parseDecimalNumber(value) {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return null;
  }
  if (Math.abs(num) < 1 && num !== 0) {
    return num * 100;
  }
  return num;
}

async function importData() {
  const filePath = path.join(__dirname, '私募星工厂全量私募业绩跟踪_20260708.xlsx');
  const dataDate = new Date('2026-07-08');
  const cutoffDate = new Date('2026-07-08');
  
  console.log('📂 读取 Excel 文件...');
  const workbook = XLSX.readFile(filePath);
  
  let totalImported = 0;
  
  for (const sheetName of workbook.SheetNames) {
    const strategyType = STRATEGY_MAP[sheetName];
    if (!strategyType) {
      console.log(`⚠️ 跳过未知策略: ${sheetName}`);
      continue;
    }
    
    console.log(`\n📋 导入 ${sheetName} -> ${strategyType}...`);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1 });
    const headers = data[0];
    const rows = data.slice(1).filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''));
    
    console.log(`  找到 ${rows.length} 行数据`);
    console.log(`  列名:`, headers);
    
    // 判断使用新旧字段
    const indexEnhancedTypes = ['index-enhanced-300', 'index-enhanced-500', 'index-enhanced-1000', 'index-enhanced-2000', 'index-enhanced-alternative'];
    const isIndexEnhanced = indexEnhancedTypes.includes(strategyType);
    const isArbitrage = strategyType === 'arbitrage';
    const useNewFields = dataDate >= cutoffDate && (isIndexEnhanced || isArbitrage);
    
    console.log(`  使用${useNewFields ? '新' : '旧'}字段`);
    
    let imported = 0;
    
    for (const row of rows) {
      const rowObj = {};
      headers.forEach((header, i) => {
        if (header && typeof header === 'string') {
          rowObj[header] = row[i];
        }
      });
      
      if (!rowObj['产品名称']) continue;
      
      try {
        const productData = {
          dataDate,
          strategyType,
          fundManager: String(rowObj['基金管理人'] || ''),
          managerScale: String(rowObj['管理人规模'] || ''),
          isLargeScale: String(rowObj['管理人规模'] || '').includes('100亿'),
          productName: String(rowObj['产品名称'] || ''),
          strategyCategory: rowObj['策略分类'] ? String(rowObj['策略分类']) : null,
        };
        
        if (useNewFields) {
          // 新字段
          productData.excessReturn1w = parseDecimalNumber(rowObj['近一周超额收益']);
          productData.excessReturn3m = parseDecimalNumber(rowObj['近三月超额收益']);
          productData.excessReturnYtd = parseDecimalNumber(rowObj['今年以来超额收益']);
          productData.excessAnnualizedReturn = parseDecimalNumber(rowObj['成立以来超额年化收益']);
          productData.excessYtdMaxDrawdown = parseDecimalNumber(rowObj['今年以来超额最大回撤']);
          productData.excessInceptionMaxDrawdown = parseDecimalNumber(rowObj['成立以来超额最大回撤']);
          productData.excessAnnualizedVolatility = parseDecimalNumber(rowObj['成立以来超额年化波动率']);
          
          if (isArbitrage) {
            productData.karmaRatio = parseDecimalNumber(rowObj['成立以来卡玛比率']);
          } else {
            productData.excessSharpeRatio = parseDecimalNumber(rowObj['成立以来超额夏普比率']);
          }
        } else {
          // 旧字段
          productData.weeklyReturn = parseDecimalNumber(rowObj['近一周收益']);
          productData.monthlyReturn = parseDecimalNumber(rowObj['近一月收益']);
          productData.ytdReturn = parseDecimalNumber(rowObj['今年以来收益']);
          productData.annualizedReturnSinceInception = parseDecimalNumber(rowObj['成立以来年化收益']);
          productData.ytdMaxDrawdown = parseDecimalNumber(rowObj['今年以来最大回撤']);
          productData.inceptionMaxDrawdown = parseDecimalNumber(rowObj['成立以来最大回撤']);
          productData.annualizedVolatility = parseDecimalNumber(rowObj['成立以来年化波动率']);
          productData.sharpeRatio = parseDecimalNumber(rowObj['成立以来夏普比率']);
        }
        
        await prisma.fundProduct.create({ data: productData });
        imported++;
      } catch (e) {
        console.error(`  ❌ 导入失败 [${rowObj['产品名称']}]:`, e.message);
      }
    }
    
    console.log(`  ✅ 成功导入 ${imported} 条`);
    totalImported += imported;
  }
  
  console.log(`\n🎉 导入完成！共导入 ${totalImported} 条记录`);
  await prisma.$disconnect();
}

importData().catch(e => {
  console.error('导入失败:', e);
  prisma.$disconnect();
  process.exit(1);
});
