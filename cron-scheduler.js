/**
 * 独立的邮件解析和指标计算定时任务
 * 不依赖 Next.js instrumentation，独立运行
 * 用于 standalone 部署模式（instrumentation 不兼容）
 */
require('dotenv').config({ path: '.env' });

const cron = require('node-cron');
const dayjs = require('dayjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

dayjs.extend(require('dayjs/plugin/timezone'));
dayjs.extend(require('dayjs/plugin/utc'));

let schedulerStarted = false;

/**
 * 初始化定时任务
 */
function initScheduler() {
  if (schedulerStarted) {
    console.log('⚠️ 定时任务已启动，跳过');
    return;
  }

  const schedule = process.env.EMAIL_PARSE_SCHEDULE || '0 9,11,13,15,17,20 * * *';
  
  console.log('🕒 初始化定时任务: ' + schedule);
  console.log('🌍 当前时间: ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  
  // 定时任务：邮件解析 + 自动计算指标
  cron.schedule(schedule, async () => {
    console.log('⏰ 触发定时任务 [' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + ']');
    try {
      // TODO: 邮件解析逻辑（需要在 engine.ts 中实现）
      console.log('📧 邮件解析逻辑待实现...');
      
      // 自动计算最新日期的收益指标
      console.log('🔄 开始自动计算收益指标...');
      await autoCalculateMetrics();
    } catch (error) {
      console.error('❌ 定时任务失败:', error);
    }
  }, {
    timezone: "Asia/Shanghai"
  });
  
  schedulerStarted = true;
  console.log('✅ 定时任务已启动');
  
  // 启动时立即执行一次指标计算
  console.log('🚀 启动时立即执行一次指标计算...');
  autoCalculateMetrics().catch(err => console.error('初始化指标计算失败:', err));
}

/**
 * 自动计算收益指标
 * 通过调用本地 API 复用已有的计算逻辑
 * 仅计算周五或节假日前工作日的数据
 */
async function autoCalculateMetrics() {
  try {
    console.log('📊 开始自动计算收益指标...');
    
    const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day').toDate();
    
    // 使用原始 SQL 查询（数据库中 navDate 是 BigInt 时间戳）
    const navDates = await prisma.$queryRaw`
      SELECT DISTINCT navDate FROM NavData WHERE navDate >= ${sevenDaysAgo.getTime()} ORDER BY navDate DESC
    `;
    
    const fundProductDates = await prisma.$queryRaw`
      SELECT DISTINCT dataDate FROM FundProduct WHERE dataDate >= ${sevenDaysAgo.getTime()} ORDER BY dataDate DESC
    `;
    
    const fundProductDateSet = new Set(fundProductDates.map(d => Number(d.dataDate)));
    
    // 过滤：只保留周五或节假日前工作日
    const validDates = navDates
      .map(d => Number(d.navDate))
      .filter(timestamp => {
        const date = dayjs(timestamp);
        const dayOfWeek = date.day(); // 0=周日, 5=周五, 6=周六
        
        // 如果是周五，保留
        if (dayOfWeek === 5) return true;
        
        // TODO: 节假日判断逻辑（需要维护节假日列表）
        // 暂时只保留周五
        return false;
      });
    
    const missingDates = validDates.filter(timestamp => !fundProductDateSet.has(timestamp));
    
    if (missingDates.length === 0) {
      console.log('✅ 所有周五的指标已计算，无需补充');
      return;
    }
    
    console.log('📅 发现 ' + missingDates.length + ' 个周五需要计算指标');
    
    // 调用 PUT API 来计算指标（复用已有的 API 逻辑）
    const fetch = require('node-fetch');
    
    for (const timestamp of missingDates) {
      const dateStr = dayjs(timestamp).format('YYYY-MM-DD');
      const dayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(timestamp).day()];
      console.log('🧮 计算 ' + dateStr + ' (' + dayName + ') 的收益指标...');
      
      try {
        // 调用本地的 calculate-metrics API
        const response = await fetch('http://localhost:7371/api/strategy/calculate-metrics', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: '观察池', dataDate: dateStr })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log('  ✅ ' + dateStr + ' 计算完成: ' + result.successCount + ' 成功, ' + result.failCount + ' 失败');
        } else {
          console.error('  ❌ ' + dateStr + ' 计算失败:', result.error);
        }
      } catch (error) {
        console.error('  ❌ ' + dateStr + ' 计算失败:', error.message);
      }
    }
    
    console.log('✅ 自动计算收益指标完成');
  } catch (error) {
    console.error('❌ 自动计算收益指标失败:', error);
  }
}

// 启动定时任务
initScheduler();

// 优雅退出
process.on('SIGTERM', () => {
  console.log('👋 收到 SIGTERM 信号，优雅退出...');
  prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 收到 SIGINT 信号，优雅退出...');
  prisma.$disconnect();
  process.exit(0);
});
