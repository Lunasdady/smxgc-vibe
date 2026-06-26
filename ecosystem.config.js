module.exports = {
  apps: [{
    name: 'smxgc-vibe',
    script: '.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // 如果使用 SQLite，数据库文件在项目根目录
      DATABASE_URL: 'file:/var/www/my-app/dev.db',
      // 如果使用 PostgreSQL 或 MySQL，替换为实际连接字符串
      // DATABASE_URL: 'postgresql://user:password@localhost:5432/mydb'
      ADMIN_PASSWORD: 'habtot-mevxop-5Qekbu'   // 添加这一行，设置你想要的密码
    },
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '500M',
    // 可选：自动重启
    autorestart: true,
    watch: false,
  }]
};
