#!/usr/bin/env node
/**
 * 分析数据库中的日期分布
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prisma/dev.db');
const db = new sqlite3.Database(dbPath);

console.log('=== 数据库日期分析报告 ===\n');

// 1. 查询所有日期
db.all("SELECT DISTINCT dataDate FROM FundProduct WHERE dataDate IS NOT NULL ORDER BY dataDate DESC", [], (err, rows) => {
  if (err) {
    console.error('查询失败:', err);
    db.close();
    return;
  }

  console.log(`总日期数: ${rows.length}\n`);
  console.log('日期详情:');
  
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  
  rows.forEach((row, index) => {
    const date = new Date(row.dataDate);
    const dateStr = date.toISOString().split('T')[0];
    const weekday = weekdays[date.getDay()];
    const isFriday = date.getDay() === 5;
    
    console.log(`${index + 1}. ${dateStr} - ${weekday} ${isFriday ? '✓' : ''} (时间戳: ${row.dataDate})`);
  });

  // 2. 统计周五数量
  const fridays = rows.filter(row => {
    const date = new Date(row.dataDate);
    return date.getDay() === 5;
  });

  console.log(`\n周五数量: ${fridays.length}/${rows.length}`);

  // 3. 每个日期的产品数量
  console.log('\n每个日期的产品数量:');
  db.all("SELECT dataDate, COUNT(*) as count FROM FundProduct WHERE dataDate IS NOT NULL GROUP BY dataDate ORDER BY dataDate DESC", [], (err, rows) => {
    if (err) {
      console.error('查询失败:', err);
      db.close();
      return;
    }

    rows.forEach((row, index) => {
      const date = new Date(row.dataDate);
      const dateStr = date.toISOString().split('T')[0];
      const weekday = weekdays[date.getDay()];
      const isFriday = date.getDay() === 5;
      
      console.log(`${index + 1}. ${dateStr} - ${weekday} ${isFriday ? '✓' : ''} - ${row.count}个产品`);
    });

    // 4. 总产品数
    db.get("SELECT COUNT(*) as total FROM FundProduct", [], (err, row) => {
      if (err) {
        console.error('查询失败:', err);
        db.close();
        return;
      }

      console.log(`\n总产品数: ${row.total}`);
      db.close();
    });
  });
});
