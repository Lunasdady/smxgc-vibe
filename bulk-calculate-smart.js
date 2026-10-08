/**
 * 智能批量计算所有历史日期的FundProduct数据
 * 规则：
 * 1. 优先使用周五数据
 * 2. 如果周五数据不足（< 500条记录），向前查找最近一个工作日的数据
 * 3. 每个日期只计算一次
 */

const { execSync } = require('child_process');
const path = require('path');

const DB_PATH = path.join(__dirname, 'prisma/dev.db');
const API_URL = 'http://localhost:3000/api/strategy/calculate-metrics';
const MIN_RECORDS = 500; // 最小记录数阈值

/**
 * 执行SQLite查询
 */
function query(sql) {
  const result = execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: 'utf-8' });
  return result.trim().split('\n').filter(Boolean);
}

/**
 * 获取所有有数据的日期（按日期倒序）
 */
function getAllDatesWithData() {
  const sql = `
    SELECT navDate, COUNT(*) as cnt
    FROM NavData
    WHERE navDate IS NOT NULL
    GROUP BY navDate
    ORDER BY navDate DESC
  `;
  const rows = query(sql);
  return rows.map(row => {
    const [ts, count] = row.split('|');
    return {
      timestamp: parseInt(ts),
      date: new Date(parseInt(ts)).toISOString().split('T')[0],
      count: parseInt(count),
      dayOfWeek: new Date(parseInt(ts)).getDay(), // 0=周日, 1=周一, ..., 5=周五, 6=周六
    };
  });
}

/**
 * 获取所有周五日期（从最早到最晚）
 */
function getAllFridays() {
  const sql = `
    SELECT DISTINCT navDate
    FROM NavData
    WHERE navDate IS NOT NULL
      AND CAST(strftime('%w', navDate/1000, 'unixepoch') AS INTEGER) = 5
    ORDER BY navDate ASC
  `;
  const rows = query(sql);
  return rows.map(ts => ({
    timestamp: parseInt(ts),
    date: new Date(parseInt(ts)).toISOString().split('T')[0],
  }));
}

/**
 * 为每个周五找到最佳数据日期
 * 规则：
 * 1. 优先使用周五数据（如果 >= MIN_RECORDS）
 * 2. 否则向前查找最近一个工作日的数据（周一到周四）
 */
function findBestDatesForFridays(allDates, fridays) {
  const allDatesMap = new Map(allDates.map(d => [d.date, d]));
  const result = [];

  for (const friday of fridays) {
    const fridayData = allDatesMap.get(friday.date);
    
    if (fridayData && fridayData.count >= MIN_RECORDS) {
      // 周五数据充足，直接使用
      result.push({
        targetFriday: friday.date,
        actualDate: friday.date,
        timestamp: friday.timestamp,
        count: fridayData.count,
        isFriday: true,
      });
    } else {
      // 周五数据不足，向前查找最近的工作日
      let bestDate = null;
      
      // 从所有日期中查找比该周五早的最近工作日
      for (const d of allDates) {
        if (d.timestamp < friday.timestamp && d.count >= MIN_RECORDS) {
          // 只考虑工作日（周一到周五）
          if (d.dayOfWeek >= 1 && d.dayOfWeek <= 5) {
            bestDate = d;
            break;
          }
        }
      }
      
      if (bestDate) {
        result.push({
          targetFriday: friday.date,
          actualDate: bestDate.date,
          timestamp: bestDate.timestamp,
          count: bestDate.count,
          isFriday: false,
        });
      } else {
        console.warn(`⚠️ 无法找到 ${friday.date} 的有效数据日期`);
      }
    }
  }

  return result;
}

/**
 * 调用API计算指定日期的指标
 */
async function calculateForDate(date, category = '观察池') {
  try {
    const response = await fetch(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, dataDate: date }),
    });
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('=== 智能批量计算FundProduct数据 ===\n');
  
  // 1. 获取所有有数据的日期
  console.log('1. 分析NavData日期分布...');
  const allDates = getAllDatesWithData();
  console.log(`   共有 ${allDates.length} 个不同日期`);
  console.log(`   数据量范围: ${Math.min(...allDates.map(d => d.count))} ~ ${Math.max(...allDates.map(d => d.count))} 条记录`);
  
  // 2. 获取所有周五
  console.log('\n2. 获取所有周五日期...');
  const fridays = getAllFridays();
  console.log(`   共有 ${fridays.length} 个周五`);
  console.log(`   最早: ${fridays[0].date}, 最新: ${fridays[fridays.length - 1].date}`);
  
  // 3. 为每个周五找到最佳数据日期
  console.log('\n3. 为每个周五匹配最佳数据日期...');
  const bestDates = findBestDatesForFridays(allDates, fridays);
  
  const fridayCount = bestDates.filter(d => d.isFriday).length;
  const fallbackCount = bestDates.filter(d => !d.isFriday).length;
  
  console.log(`   直接使用周五数据: ${fridayCount} 个`);
  console.log(`   回退到前一个工作日: ${fallbackCount} 个`);
  
  // 显示前10个回退的例子
  const fallbackExamples = bestDates.filter(d => !d.isFriday).slice(0, 10);
  if (fallbackExamples.length > 0) {
    console.log('\n   回退示例:');
    fallbackExamples.forEach(d => {
      console.log(`     ${d.targetFriday}(周五) -> ${d.actualDate}(前一个工作日, ${d.count}条)`);
    });
  }
  
  // 4. 去重：同一个actualDate只计算一次
  const uniqueDates = [];
  const seen = new Set();
  for (const d of bestDates) {
    if (!seen.has(d.actualDate)) {
      seen.add(d.actualDate);
      uniqueDates.push(d);
    }
  }
  console.log(`\n4. 去重后需要计算的日期: ${uniqueDates.length} 个`);
  
  // 5. 批量计算
  console.log('\n5. 开始批量计算...\n');
  let totalSuccess = 0;
  let totalFail = 0;
  
  for (let i = 0; i < uniqueDates.length; i++) {
    const item = uniqueDates[i];
    const label = item.isFriday 
      ? `${item.actualDate}(周五)` 
      : `${item.targetFriday}(周五) -> ${item.actualDate}(工作日)`;
    
    console.log(`[${i + 1}/${uniqueDates.length}] 计算 ${label}...`);
    
    const result = await calculateForDate(item.actualDate);
    
    if (result.error) {
      console.log(`   ❌ 错误: ${result.error}`);
      totalFail += 592;
    } else {
      console.log(`   ✅ 成功: ${result.successCount}, 失败: ${result.failCount}`);
      totalSuccess += result.successCount;
      totalFail += result.failCount;
    }
    
    // 每10个日期暂停1秒
    if ((i + 1) % 10 === 0) {
      console.log('   ⏸️ 暂停1秒...\n');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // 6. 汇总
  console.log('\n=== 批量计算完成 ===');
  console.log(`总日期数: ${uniqueDates.length}`);
  console.log(`总成功: ${totalSuccess}`);
  console.log(`总失败: ${totalFail}`);
  console.log(`成功率: ${((totalSuccess / (totalSuccess + totalFail)) * 100).toFixed(2)}%`);
  
  // 7. 验证FundProduct表
  console.log('\n=== 验证FundProduct表 ===');
  const countSql = `SELECT COUNT(DISTINCT dataDate) as dateCount, COUNT(*) as totalRecords FROM FundProduct`;
  const countResult = query(countSql)[0];
  console.log(`不同日期数: ${countResult.split('|')[0]}`);
  console.log(`总记录数: ${countResult.split('|')[1]}`);
}

main().catch(console.error);
