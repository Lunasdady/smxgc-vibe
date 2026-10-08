# 邮箱配置示例

**更新日期**: 2026-09-20  
**用途**: 配置邮件解析系统，自动解析业绩邮件并导入净值数据

---

## 📋 配置字段说明

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| email | string | ✅ | 邮箱地址 | performance@example.com |
| imapHost | string | ✅ | IMAP服务器地址 | imap.qq.com |
| imapPort | int | ✅ | IMAP端口（默认993） | 993 |
| passwordEncrypted | string | ✅ | 加密后的密码 | (系统自动加密) |
| sslEnabled | boolean | ✅ | 是否启用SSL | true |
| enabled | boolean | ✅ | 是否启用该邮箱 | true |

---

## 📧 常见邮箱服务商配置

### 1. QQ邮箱

```
邮箱地址: yourname@qq.com
IMAP服务器: imap.qq.com
IMAP端口: 993
SSL: 是
密码: 授权码（不是QQ密码，需要在QQ邮箱设置中生成）
```

**获取授权码步骤**：
1. 登录QQ邮箱网页版
2. 设置 → 账户
3. 找到"IMAP/SMTP服务"
4. 点击"开启"
5. 按提示生成授权码（16位字母）

---

### 2. 163网易邮箱

```
邮箱地址: yourname@163.com
IMAP服务器: imap.163.com
IMAP端口: 993
SSL: 是
密码: 授权码（不是163密码）
```

**获取授权码步骤**：
1. 登录163邮箱
2. 设置 → POP3/SMTP/IMAP
3. 开启IMAP服务
4. 生成客户端授权码

---

### 3. Gmail

```
邮箱地址: yourname@gmail.com
IMAP服务器: imap.gmail.com
IMAP端口: 993
SSL: 是
密码: 应用专用密码（需开启2步验证）
```

**获取应用专用密码**：
1. 登录Google账号
2. 安全性 → 2步验证
3. 应用专用密码
4. 生成16位密码

---

### 4. Outlook/Hotmail

```
邮箱地址: yourname@outlook.com
IMAP服务器: imap-mail.outlook.com
IMAP端口: 993
SSL: 是
密码: 邮箱密码
```

---

### 5. 企业邮箱（腾讯企业邮箱）

```
邮箱地址: yourname@yourcompany.com
IMAP服务器: imap.exmail.qq.com
IMAP端口: 993
SSL: 是
密码: 邮箱密码或授权码
```

---

### 6. 阿里企业邮箱

```
邮箱地址: yourname@yourcompany.com
IMAP服务器: imap.qiye.aliyun.com
IMAP端口: 993
SSL: 是
密码: 邮箱密码
```

---

## 🔧 配置方法

### 方法1: 通过管理后台配置（推荐）⭐

1. 访问管理后台：`http://localhost:3000/admin/operation`
2. 找到"邮箱配置"模块
3. 点击"添加邮箱"
4. 填写配置信息：
   ```
   邮箱地址: performance@yourcompany.com
   IMAP服务器: imap.exmail.qq.com
   IMAP端口: 993
   SSL: ✓ 勾选
   密码: yourpassword (系统会自动加密)
   启用: ✓ 勾选
   ```
5. 点击"保存"

---

### 方法2: 通过API直接配置

**创建邮箱配置脚本** `add-email-config.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 简单的AES加密（实际应使用更安全的加密）
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32); // 实际应保存在.env中
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

async function addEmailConfig() {
  console.log('添加邮箱配置...');
  
  const config = await prisma.emailConfig.create({
    data: {
      email: 'performance@yourcompany.com',  // ← 修改为您的邮箱
      imapHost: 'imap.exmail.qq.com',        // ← 修改为IMAP服务器
      imapPort: 993,
      passwordEncrypted: encrypt('YourPassword123'), // ← 修改为密码
      sslEnabled: true,
      enabled: true,
    },
  });
  
  console.log('✅ 邮箱配置已添加:', config.email);
  console.log('配置ID:', config.id);
}

addEmailConfig()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**运行脚本**：
```bash
node add-email-config.js
```

---

### 方法3: 直接SQL插入（快速测试）

```sql
-- 注意：密码应该加密存储，这里仅为示例
INSERT INTO EmailConfig (
  email, 
  imapHost, 
  imapPort, 
  passwordEncrypted, 
  sslEnabled, 
  enabled
) VALUES (
  'performance@yourcompany.com',
  'imap.exmail.qq.com',
  993,
  'encrypted_password_here',  -- 实际应使用加密后的密码
  1,
  1
);
```

---

## 🧪 测试连接

### 测试IMAP连接

创建测试脚本 `test-imap.js`:

```javascript
const Imap = require('imap');

const imap = new Imap({
  user: 'performance@yourcompany.com',
  password: 'YourPassword123',
  host: 'imap.exmail.qq.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

imap.once('ready', function() {
  console.log('✅ IMAP连接成功！');
  
  openInbox(function(err, box) {
    if (err) {
      console.error('❌ 打开收件箱失败:', err);
      return;
    }
    
    console.log('📬 收件箱邮件数量:', box.messages.total);
    imap.closeBox();
    imap.end();
  });
});

imap.once('error', function(err) {
  console.error('❌ IMAP连接失败:', err.message);
  if (err.code === 'EAUTH') {
    console.log('提示: 密码错误或授权码无效');
  }
});

imap.connect();
```

**安装依赖**：
```bash
npm install imap
```

**运行测试**：
```bash
node test-imap.js
```

---

## 📝 完整配置示例

### 示例1: 腾讯企业邮箱

```json
{
  "email": "performance@smxgc.com",
  "imapHost": "imap.exmail.qq.com",
  "imapPort": 993,
  "passwordEncrypted": "(加密后的密码)",
  "sslEnabled": true,
  "enabled": true
}
```

### 示例2: QQ个人邮箱

```json
{
  "email": "123456789@qq.com",
  "imapHost": "imap.qq.com",
  "imapPort": 993,
  "passwordEncrypted": "(QQ邮箱授权码)",
  "sslEnabled": true,
  "enabled": true
}
```

### 示例3: 163邮箱

```json
{
  "email": "yourname@163.com",
  "imapHost": "imap.163.com",
  "imapPort": 993,
  "passwordEncrypted": "(163授权码)",
  "sslEnabled": true,
  "enabled": true
}
```

---

## 🔐 密码加密

### 生产环境加密方案

在 `.env` 文件中配置加密密钥：

```env
# 邮箱加密密钥（32字节）
EMAIL_ENCRYPTION_KEY=your-32-byte-secret-key-here-123456789012
```

加密工具函数 `src/lib/email-encryptor.ts`:

```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.EMAIL_ENCRYPTION_KEY!, 'utf8');

export function encryptEmail(password: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptEmail(encrypted: string): string {
  const [ivHex, encryptedHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## 📊 配置验证

### 检查配置是否成功

```bash
# 查询邮箱配置
sqlite3 prisma/dev.db "
  SELECT id, email, imapHost, imapPort, sslEnabled, enabled 
  FROM EmailConfig;
"

# 检查最后解析时间
sqlite3 prisma/dev.db "
  SELECT email, lastParsedAt, lastParsedUid 
  FROM EmailConfig 
  WHERE enabled = 1;
"
```

---

## 🚀 配置完成后

### 1. 测试邮件解析

访问管理后台 `/admin/operation`，点击"立即解析"按钮。

### 2. 查看解析日志

```bash
sqlite3 prisma/dev.db "
  SELECT id, status, parseTime, emailSubject 
  FROM ParseLog 
  ORDER BY parseTime DESC 
  LIMIT 10;
"
```

### 3. 检查NavData表

```bash
sqlite3 prisma/dev.db "
  SELECT COUNT(*) as navDataCount FROM NavData;
"
```

---

## ⚠️ 常见问题

### Q1: 连接失败

**错误**: `EAUTH` 或 `Authentication failed`

**解决方案**:
- QQ邮箱：使用授权码，不是QQ密码
- 163邮箱：使用客户端授权码
- Gmail：使用应用专用密码

### Q2: 找不到邮件

**检查**:
1. 邮箱是否配置正确
2. 邮件是否在收件箱（不在垃圾箱）
3. 解析时间范围是否正确

### Q3: SSL错误

**解决方案**:
- 确认端口是993
- 确认sslEnabled设置为true
- 某些服务器需要设置tlsOptions

---

## 📞 获取帮助

如果配置遇到问题，请提供：
1. 邮箱类型（QQ/163/Gmail等）
2. 错误信息
3. IMAP服务器地址
4. 端口号

---

**文档版本**: v1.0  
**创建时间**: 2026-09-20  
**状态**: 可供参考
