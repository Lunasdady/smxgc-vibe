// Prisma 配置文件
// 仅在 Prisma CLI 命令中使用

// 动态加载 dotenv
if (typeof process !== 'undefined') {
  try {
    require('dotenv/config');
  } catch (e) {
    // dotenv 可能未安装
  }
}

const config = {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
};

export default config;
