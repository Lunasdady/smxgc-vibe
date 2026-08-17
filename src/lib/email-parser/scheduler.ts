import cron from 'node-cron';
import prisma from '@/lib/db';

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
  
  cron.schedule(schedule, async () => {
    console.log('⏰ 触发定时邮件解析任务...');
    try {
      await executeParseTask();
    } catch (error) {
      console.error('❌ 定时解析任务失败:', error);
    }
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
 * 解析单个邮箱
 */
async function parseSingleEmail(configId: number): Promise<void> {
  // TODO: 实现完整的解析逻辑
  // 1. 建立IMAP连接
  // 2. 获取新邮件
  // 3. 解析HTML和Excel
  // 4. 字段映射和数据清洗
  // 5. 存储净值数据
  // 6. 更新lastParsedUid
  
  await prisma.emailConfig.update({
    where: { id: configId },
    data: { lastParsedAt: new Date() },
  });
}
