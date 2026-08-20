/**
 * 邮件解析定时任务管理器
 * 确保在服务启动时初始化一次
 */

import { initEmailScheduler } from './scheduler';
import { initDefaultRules } from './rules';

let initialized = false;

/**
 * 初始化邮件解析系统（确保只执行一次）
 */
export async function ensureEmailParserInitialized(): Promise<void> {
  if (initialized) {
    return;
  }
  
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
  
  initialized = true;
  console.log('✅ 邮件解析系统初始化完成');
}
