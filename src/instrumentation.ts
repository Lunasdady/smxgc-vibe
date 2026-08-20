/**
 * Next.js Instrumentation文件
 * 在服务启动时执行初始化逻辑
 */

import { initEmailScheduler } from '@/lib/email-parser/scheduler';
import { initDefaultRules } from '@/lib/email-parser/rules';

export async function register() {
  // 只在Node.js环境中执行（不在Edge Runtime中）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔧 初始化邮件解析系统...');
    
    // 1. 初始化默认解析规则
    try {
      await initDefaultRules();
    } catch (error) {
      console.error('⚠️ 初始化默认解析规则失败:', error);
    }
    
    // 2. 启动定时任务
    try {
      initEmailScheduler();
    } catch (error) {
      console.error('❌ 启动定时任务失败:', error);
    }
    
    console.log('✅ 邮件解析系统初始化完成');
  }
}
