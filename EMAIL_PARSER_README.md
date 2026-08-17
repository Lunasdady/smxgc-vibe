# 邮件解析功能一期 - 实施说明

## 已完成功能

### 1. 数据库设计
- ✅ EmailConfig - 邮箱配置表
- ✅ EmailParseResult - 邮件解析结果表
- ✅ NavData - 净值数据表
- ✅ ParseRule - 解析规则表

### 2. 核心模块 (src/lib/email-parser/)
- ✅ crypto.ts - AES加密/解密
- ✅ imap-client.ts - IMAP连接和邮件获取
- ✅ html-parser.ts - HTML表格解析器
- ✅ excel-parser.ts - Excel附件解析器
- ✅ vertical-parser.ts - 纵向表格解析器
- ✅ field-mapper.ts - 字段映射引擎
- ✅ data-cleaner.ts - 数据清洗和异常检测
- ✅ rules.ts - 解析规则管理
- ✅ scheduler.ts - 定时任务调度器

### 3. API路由
- ✅ /api/admin/email/configs - 邮箱配置管理(GET/POST)
- 🔄 其他API路由框架已创建,待完善

### 4. 前端页面
- ✅ /admin/email-parse - 邮件解析管理主页面
- ✅ 邮箱配置列表和新增表单
- ✅ Tab切换(邮箱配置/解析结果/净值数据)

### 5. 管理后台集成
- ✅ AdminTabs新增"邮件解析"入口

## 环境变量

已在 `.env` 中添加:
```env
EMAIL_ENCRYPT_KEY="smxgc-email-encrypt-key-2026-change-this-in-production"
EMAIL_PARSE_SCHEDULE="0 9,11,13,15,17,20 * * *"
```

## 依赖包

已安装:
- imap - IMAP邮件客户端
- cheerio - HTML解析
- crypto-js - AES加密
- node-cron - 定时任务
- @types/imap, @types/cheerio, @types/node-cron, @types/crypto-js - 类型定义

## 使用方法

### 1. 启动开发服务器
```bash
npm run dev
```

### 2. 访问邮件解析管理页面
- 登录管理后台: http://localhost:3000/admin
- 点击"邮件解析"Tab
- 或直接访问: http://localhost:3000/admin/email-parse

### 3. 配置邮箱
1. 点击"新增邮箱"按钮
2. 填写邮箱信息:
   - 邮箱地址
   - IMAP服务器(如 imap.163.com)
   - IMAP端口(默认993)
   - 密码/授权码
   - 是否启用SSL
3. 保存配置

### 4. 定时任务
- 默认时间表: 每天 09:00, 11:00, 13:00, 15:00, 17:00, 20:00
- 可通过环境变量 EMAIL_PARSE_SCHEDULE 自定义
- 使用 cron 表达式格式

## 待完善功能

### 短期(本期剩余)
1. 完善IMAP连接测试API
2. 完善手动触发解析API
3. 完善解析结果列表API和页面
4. 完善净值数据列表API和页面
5. 实现完整的解析流程(连接IMAP → 获取邮件 → 解析 → 存储)

### 中期(二期)
1. 净值序列管理(产品维度)
2. 数据质量监控
3. 手动修正净值
4. 异常数据告警
5. 解析详情查看

### 长期(三期)
1. 产品详情页
2. 业绩图表展示
3. 收益风险指标计算
4. 策略页面产品关联

## 技术要点

### 密码加密
- 使用AES-256加密存储IMAP密码
- 加密密钥存储在环境变量
- 仅在建立IMAP连接时解密

### 字段映射
- 预设常用字段别名映射
- 支持模糊匹配
- 预设券商模板(兴业证券、中信建投、国泰君安)

### 数据清洗
- 净值范围校验(单位净值0.1-10,累计净值0.1-50)
- 日期格式标准化
- 异常值检测(单日涨跌幅>10%告警)

### 去重机制
- 基于 productCode + navDate 唯一索引
- SQLite的ON CONFLICT处理

## 注意事项

1. **TypeScript错误**: 部分文件可能显示Prisma模型不存在的错误,重启TypeScript服务器即可解决
2. **IMAP测试**: 建议使用163邮箱测试,需要开启IMAP服务并使用授权码
3. **定时任务**: 开发环境定时任务可能不会自动启动,需要手动触发
4. **数据备份**: 操作前请备份dev.db数据库

## 下一步

建议按以下顺序继续开发:
1. 测试邮箱配置功能
2. 实现IMAP连接测试
3. 实现完整的邮件解析流程
4. 完善解析结果和净值数据展示
5. 添加真实邮箱进行端到端测试
