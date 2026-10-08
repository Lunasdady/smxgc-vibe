import cron from 'node-cron';
import prisma from '@/lib/db';
import { parseEmailConfig } from './engine';

let schedulerStarted = false;

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
