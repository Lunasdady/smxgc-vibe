/**
 * 批量计算所有历史日期的FundProduct数据
 * 用法: node bulk-calculate-metrics.js
 */

const fs = require('fs');
const path = require('path');

// 读取数据库获取所有周五日期
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, 'prisma/dev.db');

function getFridayDates() {
  const sql = `
    SELECT DISTINCT navDate 
    FROM NavData 
    WHERE navDate IS NOT NULL
      AND CAST(strftime('%w', navDate/1000, 'unixepoch') AS INTEGER) = 5
    ORDER BY navDate DESC;
  `;
  
  const result = execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: 'utf-8' });
  const timestamps = result.trim().split('\n').filter(Boolean);
  
  return timestamps.map(ts => {
    const date = new Date(parseInt(ts));
    return date.toISOString().split('T')[0];
  });
}

async function calculateForDate(date, category = '观察池') {
  const response = await fetch('http://localhost:3000/api/strategy/calculate-metrics', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, dataDate: date }),
  });
  
  return await response.json();
}

async function main() {
  console.log('获取所有周五日期...');
  const dates = getFridayDates();
  console.log(`共 ${dates.length} 个周五日期`);
  console.log('最近10个:', dates.slice(0, 10));
  
  let totalSuccess = 0;
  let totalFail = 0;
  
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    console.log(`\n[${i + 1}/${dates.length}] 计算 ${date}...`);
    
    try {
      const result = await calculateForDate(date);
      console.log(`  成功: ${result.successCount}, 失败: ${result.failCount}`);
      totalSuccess += result.successCount;
      totalFail += result.failCount;
      
      // 每10个日期暂停1秒，避免服务器过载
      if ((i + 1) % 10 === 0) {
        console.log('暂停1秒...');
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error(`  错误: ${error.message}`);
    }
  }
  
  console.log(`\n=== 批量计算完成 ===`);
  console.log(`总成功: ${totalSuccess}`);
  console.log(`总失败: ${totalFail}`);
}

main().catch(console.error);
