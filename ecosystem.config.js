/**
 * PM2 多进程配置文件
 * 用于管理 Next.js 服务和独立定时任务进程
 * 
 * 注意：standalone 模式下 instrumentation 不兼容，因此使用独立进程运行定时任务
 */
module.exports = {
  apps: [
    {
      // Next.js Web 服务
      name: 'smxgc-vibe-test',
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 7371
      },
      exp_backoff_restart_delay: 100,
      max_memory_restart: '500M',
      error_file: '/root/.pm2/logs/smxgc-vibe-test-error.log',
      out_file: '/root/.pm2/logs/smxgc-vibe-test-out.log',
      merge_logs: true
    },
    {
      // 定时任务进程（邮件解析 + 自动计算指标）
      name: 'smxgc-vibe-test-scheduler',
      script: 'cron-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      exp_backoff_restart_delay: 100,
      max_memory_restart: '200M',
      error_file: '/root/.pm2/logs/smxgc-vibe-scheduler-error.log',
      out_file: '/root/.pm2/logs/smxgc-vibe-scheduler-out.log',
      merge_logs: true
    }
  ]
};
