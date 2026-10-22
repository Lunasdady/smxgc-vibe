import cron from 'node-cron';
import prisma from '@/lib/db';
import { parseEmailConfig } from './engine';
import dayjs from 'dayjs';

let schedulerStarted = false;

/**
 * 检查指定日期是否是中国法定节假日的前一个工作日
 * 数据来源：国务院办公厅关于2025-2026年部分节假日安排的通知
 * https://www.gov.cn/zhengce/content/202411/content_6987561.htm
 * 
 * 📤 导出此函数供外部调用
 */
export function checkIfBeforeHoliday(timestamp: number): boolean {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // 2025年中国法定节假日（节前最后一个工作日）
  // 来源：国务院办公厅关于2025年部分节假日安排的通知
  const holidays2025 = [
    '2025-01-27', // 春节前（1/28除夕，1/29春节）
    '2025-04-03', // 清明节前（4/4清明，4/4-4/6放假）
    '2025-04-30', // 劳动节前（5/1-5/5放假）
    '2025-05-30', // 端午节前（5/31端午，5/31-6/2放假）
    '2025-09-30', // 国庆节前（10/1-10/7放假，9/28上班）
    '2025-12-31', // 元旦前（1/1元旦，1/1放假）
  ];
  
  // 2026年中国法定节假日（节前最后一个工作日）
  // 来源：国务院办公厅关于2026年部分节假日安排的通知
  const holidays2026 = [
    '2026-01-01', // 元旦（1/1放假）
    '2026-02-16', // 春节前（2/17除夕，2/18春节，2/15-2/21放假，2/14上班）
    '2026-04-03', // 清明节前（4/4清明，4/4-4/6放假）
    '2026-04-30', // 劳动节前（5/1-5/5放假）
    '2026-06-18', // 端午节前（6/19端午，6/19-6/21放假）
    '2026-09-24', // 中秋节前（9/25中秋，9/25-9/27放假）
    '2026-09-30', // 国庆节前（10/1-10/7放假，9/27上班，10/10上班）
  ];
  
  const allHolidays = [...holidays2025, ...holidays2026];
  
  return allHolidays.includes(dateStr);
}

/**
 * 初始化邮件解析定时任务
 */
export function initEmailScheduler(): void {
  if (schedulerStarted) {
    console.log('⚠️ 邮件解析定时任务已启动,跳过');
    return;
  }
  
  const schedule = process.env.EMAIL_PARSE_SCHEDULE || '0 9,11,13,15,17,20 * * *';
  
  console.log(`🕒 初始化邮件解析定时任务: ${schedule}`);
  console.log(`🌍 当前系统时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  
  cron.schedule(schedule, async () => {
    console.log(`⏰ 触发定时邮件解析任务 [${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}]`);
    try {
      await executeParseTask();
      
      // 邮件解析完成后，自动计算最新日期的收益指标
      console.log('🔄 邮件解析完成，开始自动计算收益指标...');
      await autoCalculateMetrics();
    } catch (error) {
      console.error('❌ 定时解析任务失败:', error);
    }
  }, {
    timezone: "Asia/Shanghai"  // 🚨 明确指定时区
  });
  
  schedulerStarted = true;
  console.log('✅ 邮件解析定时任务已启动');
}

/**
 * 执行解析任务
 */
async function executeParseTask(): Promise<void> {
  const emailConfigs = await prisma.emailConfig.findMany({
    where: { enabled: true },
  });
  
  console.log(`📧 找到 ${emailConfigs.length} 个启用的邮箱配置`);
  
  // 并发控制:最多同时解析3个邮箱
  const concurrency = 3;
  for (let i = 0; i < emailConfigs.length; i += concurrency) {
    const batch = emailConfigs.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (config) => {
        try {
          console.log(`🔍 开始解析邮箱: ${config.email}`);
          // TODO: 调用解析逻辑
          await parseSingleEmail(config.id);
        } catch (error) {
          console.error(`❌ 解析邮箱 ${config.email} 失败:`, error);
        }
      })
    );
  }
}

/**
 * 解析单个邮箱（增量解析）
 */
async function parseSingleEmail(configId: number): Promise<void> {
  console.log(`📮 开始增量解析邮箱配置ID: ${configId}`);
  
  try {
    // 调用完整的解析引擎（增量模式）
    const result = await parseEmailConfig(configId, (progress) => {
      // 定时任务不需要更新UI进度，只记录日志
      if (progress.progress % 25 === 0) { // 每25%记录一次
        console.log(`📊 进度: ${progress.progress}% - ${progress.message}`);
      }
    }, {
      fullParse: false,    // 增量解析
      testLimit: undefined, // 不限制数量
      testEarly: false,
      reparseFailed: false,
    });
    
    // 记录解析结果
    if (result.success) {
      console.log(`✅ 邮箱解析完成: 成功 ${result.successCount} 封, 失败 ${result.failedCount} 封, 跳过 ${result.skippedCount} 封`);
    } else {
      console.error(`❌ 邮箱解析失败: ${result.message}`);
    }
    
    // 更新最后解析时间
    await prisma.emailConfig.update({
      where: { id: configId },
      data: { lastParsedAt: new Date() },
    });
    
  } catch (error: any) {
    console.error(`❌ 解析邮箱配置ID ${configId} 失败:`, error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * 自动计算最新日期的收益指标
 * 在邮件解析完成后调用，计算最新有净值但无指标的日期
 * 🚨 关键：只计算周五或节假日前工作日的指标
 * 
 * 📤 导出此函数供外部调用
 */
export async function autoCalculateMetrics(): Promise<void> {
  try {
    console.log('📊 开始自动计算收益指标...');
    
    // 查找最近7天内有净值数据但尚未计算指标的日期
    const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day').toDate();
    
    // 获取最近有净值的日期（按日期分组）
    const navDates: any[] = await prisma.$queryRaw`
      SELECT DISTINCT navDate 
      FROM NavData 
      WHERE navDate >= ${sevenDaysAgo.getTime()}
      ORDER BY navDate DESC
    `;
    
    // 获取已有指标的日期
    const fundProductDates: any[] = await prisma.$queryRaw`
      SELECT DISTINCT dataDate 
      FROM FundProduct 
      WHERE dataDate >= ${sevenDaysAgo.getTime()}
      ORDER BY dataDate DESC
    `;
    
    const fundProductDateSet = new Set(
      fundProductDates.map((d: any) => Number(d.dataDate))
    );
    
    // 找出有净值但无指标的日期
    const candidateDates = navDates
      .map((d: any) => Number(d.navDate))
      .filter((timestamp: number) => !fundProductDateSet.has(timestamp));
    
    if (candidateDates.length === 0) {
      console.log('✅ 所有日期的指标已计算，无需补充');
      return;
    }
    
    console.log(`📅 发现 ${candidateDates.length} 个候选日期需要检查`);
    
    // 🚨 关键：过滤出周五或节假日前工作日
    // 📌 规则：
    // 1. 周五（dayOfWeek === 5）→ 允许
    // 2. 周末（dayOfWeek === 0 || 6）→ 跳过
    // 3. 节假日前工作日 → 需要查表确认
    // 4. 普通工作日 → 跳过
    // 5. 净值数据量必须 >= 500 条
    
    const MIN_NAV_THRESHOLD = 500; // 最小净值数据量阈值
    
    const validDates = candidateDates.filter((timestamp: number) => {
      const date = new Date(timestamp);
      const dayOfWeek = date.getDay(); // 0=周日, 5=周五, 6=周六
      const dateStr = dayjs(timestamp).format('YYYY-MM-DD');
      
      // 如果是周末，跳过
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log(`❌ ${dateStr} 是周末，跳过`);
        return false;
      }
      
      // 如果是周五，检查净值数据量
      if (dayOfWeek === 5) {
        // 检查该日期的净值数据量
        const navCount = navDates.filter((d: any) => {
          const dDate = new Date(Number(d.navDate));
          return dDate.getFullYear() === date.getFullYear() &&
                 dDate.getMonth() === date.getMonth() &&
                 dDate.getDate() === date.getDate();
        }).length;
        
        if (navCount < MIN_NAV_THRESHOLD) {
          console.log(`❌ ${dateStr} 是周五，但净值数据不足（${navCount} < ${MIN_NAV_THRESHOLD}），跳过`);
          return false;
        }
        
        console.log(`✅ ${dateStr} 是周五，净值数据 ${navCount} 条，允许计算`);
        return true;
      }
      
      // 对于周一到周四，需要检查是否是节假日前工作日
      // 使用配置化的节假日判断（从数据库或配置文件读取）
      // 简单策略：检查 2025-2026 年中国法定节假日
      const isHolidayEve = checkIfBeforeHoliday(timestamp);
      
      if (isHolidayEve) {
        // 检查净值数据量
        const navCount = navDates.filter((d: any) => {
          const dDate = new Date(Number(d.navDate));
          return dDate.getFullYear() === date.getFullYear() &&
                 dDate.getMonth() === date.getMonth() &&
                 dDate.getDate() === date.getDate();
        }).length;
        
        if (navCount < MIN_NAV_THRESHOLD) {
          console.log(`❌ ${dateStr} 是节假日前工作日，但净值数据不足（${navCount} < ${MIN_NAV_THRESHOLD}），跳过`);
          return false;
        }
        
        console.log(`✅ ${dateStr} 是节假日前工作日，净值数据 ${navCount} 条，允许计算`);
        return true;
      } else {
        console.log(`❌ ${dateStr} 是普通工作日，跳过`);
        return false;
      }
    });
    
    if (validDates.length === 0) {
      console.log('⚠️  没有周五或节假日前工作日的指标需要计算');
      return;
    }
    
    console.log(`✅ 最终确定 ${validDates.length} 个日期需要计算指标`);
    
    // 对每个有效日期计算指标
    for (const timestamp of validDates) {
      const dateStr = dayjs(timestamp).format('YYYY-MM-DD');
      console.log(`🧮 计算 ${dateStr} 的收益指标...`);
      
      try {
        // 获取观察池的所有产品
        const products = await prisma.$queryRaw`
          SELECT * FROM StrategyMapping WHERE category = '观察池'
        `;
        
        let successCount = 0;
        let failCount = 0;
        
        for (const product of products as any[]) {
          try {
            const targetDate = new Date(timestamp);
            const startDate = dayjs(targetDate).subtract(6, 'month').toDate();
            
            const navData = await prisma.navData.findMany({
              where: {
                productCode: product.productCode,
                navDate: {
                  gte: startDate,
                  lte: targetDate,
                },
              },
              orderBy: { navDate: 'asc' },
            });
            
            if (navData.length === 0) {
              failCount++;
              continue;
            }
            
            // 动态导入计算函数，避免循环依赖
            const { calculateAllMetrics } = await import('@/lib/metrics-calculator');
            const { getStrategyType } = await import('@/lib/strategy-type-utils');
            
            const formattedNavData = navData
              .filter(n => n.unitNav !== null)
              .map(n => ({
                navDate: n.navDate,
                unitNav: n.unitNav as number,
              }));
            
            const metrics = calculateAllMetrics(formattedNavData, targetDate);
            
            // 使用原始SQL插入/更新，避免Prisma类型问题
            await prisma.$executeRaw`
              INSERT INTO FundProduct (productCode, productName, dataDate, strategyType, fundManager, managerScale, isLargeScale, weeklyReturn, monthlyReturn, ytdReturn, annualizedReturnSinceInception, ytdMaxDrawdown, inceptionMaxDrawdown, annualizedVolatility, sharpeRatio)
              VALUES (${product.productCode}, ${product.productName}, ${timestamp}, ${getStrategyType(product.primaryStrategy, product.secondaryStrategy)}, '', '', 0, ${metrics.weeklyReturn}, ${metrics.monthlyReturn}, ${metrics.ytdReturn}, ${metrics.annualizedReturnSinceInception}, ${metrics.ytdMaxDrawdown}, ${metrics.inceptionMaxDrawdown}, ${metrics.annualizedVolatility}, ${metrics.sharpeRatio})
              ON CONFLICT(productCode, dataDate) DO UPDATE SET
                weeklyReturn = ${metrics.weeklyReturn},
                monthlyReturn = ${metrics.monthlyReturn},
                ytdReturn = ${metrics.ytdReturn},
                annualizedReturnSinceInception = ${metrics.annualizedReturnSinceInception},
                ytdMaxDrawdown = ${metrics.ytdMaxDrawdown},
                inceptionMaxDrawdown = ${metrics.inceptionMaxDrawdown},
                annualizedVolatility = ${metrics.annualizedVolatility},
                sharpeRatio = ${metrics.sharpeRatio}
            `;
            
            successCount++;
          } catch (error) {
            failCount++;
          }
        }
        
        console.log(`✅ ${dateStr} 计算完成: 成功${successCount}个, 失败${failCount}个`);
      } catch (error: any) {
        console.error(`❌ ${dateStr} 指标计算失败:`, error.message);
      }
    }
    
    console.log('🎉 自动计算收益指标完成');
  } catch (error: any) {
    console.error('❌ 自动计算收益指标失败:', error.message);
  }
}
