# 生产环境部署修复清单

## 🐛 已修复的Bug

### 1. API静态缓存导致数据不更新
**问题**: 导入新数据后,首页仍显示旧数据  
**原因**: Next.js生产环境默认缓存API响应  
**修复**: 
- ✅ `src/app/api/data/latest-date/route.ts` - 添加 `export const dynamic = 'force-dynamic'`
- ✅ `src/app/api/strategies/overview/route.ts` - 添加 `export const dynamic = 'force-dynamic'`

### 2. 登录用户显示错误账号
**问题**: 单用户单设备登录,却显示其他人账号  
**原因**: Cookie缺少SameSite属性 + JWT_SECRET使用弱密钥  
**修复**:
- ✅ `src/app/login/page.tsx` - Cookie添加 `SameSite=Strict`
- ✅ `src/components/Navbar.tsx` - Cookie添加 `SameSite=Strict`
- ✅ `.env` - 更新JWT_SECRET为强密钥

### 3. 首页加载阻塞
**问题**: 首页一直显示"加载数据中"  
**原因**: 数据库表不存在(被Git操作或prisma db push清空)  
**修复**:
- ✅ 执行 `npx prisma db push` 同步数据库schema
- ✅ 执行 `npx prisma generate` 重新生成Prisma Client
- ✅ 添加详细调试日志

---

## 📋 生产环境部署步骤

### 1. 提交代码
```bash
git add .
git commit -m "fix: 修复API缓存问题和登录Cookie安全问题"
```

### 2. 推送到远程
```bash
git push origin master
git push origin develop
```

### 3. 服务器部署
```bash
# SSH登录服务器
ssh user@server-ip

# 进入生产环境目录
cd /var/www/my-app

# 拉取最新代码
git pull origin master

# 安装依赖
npm install

# 同步数据库schema(重要!)
npx prisma db push

# 重新生成Prisma Client
npx prisma generate

# 构建生产版本
npm run build

# 复制静态资源到standalone目录
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

# 确保.env文件存在且配置正确
cat .env | grep DATABASE_URL
cat .env | grep JWT_SECRET

# 停止旧服务
pm2 stop smxgc-vibe

# 启动新服务
PORT=3002 pm2 start .next/standalone/server.js --name "smxgc-vibe"

# 保存PM2配置
pm2 save
```

### 4. 验证部署
```bash
# 检查服务状态
pm2 status

# 查看日志
pm2 logs smxgc-vibe --lines 50

# 测试API(应该返回最新数据日期)
curl http://localhost:3002/api/data/latest-date

# 测试首页数据API
curl "http://localhost:3002/api/strategies/overview?dataDate=2026-07-16&metric=excessReturn1w"
```

---

## ⚠️ 关键注意事项

### 数据库安全
1. **永远不要**将`dev.db`提交到Git
2. `.gitignore`必须包含:
   ```
   prisma/*.db
   *.db
   ```
3. 部署前**备份数据库**:
   ```bash
   cp /var/www/my-app/prisma/dev.db /var/www/my-app/prisma/dev.db.backup.$(date +%Y%m%d)
   ```

### 环境变量
1. `.env`文件必须包含:
   ```env
   DATABASE_URL="file:/var/www/my-app/prisma/dev.db"
   JWT_SECRET="强密钥(至少32位)"
   ADMIN_PASSWORD="管理后台密码"
   SMTP_HOST="smtp.163.com"
   SMTP_PORT="465"
   SMTP_USER="smxgc_nav_sever@163.com"
   SMTP_PASS="授权码"
   ```

2. **DATABASE_URL必须使用绝对路径**,不能用相对路径`file:./dev.db`

### API缓存策略
所有查询数据库的GET API都必须添加:
```typescript
export const dynamic = 'force-dynamic';
```

**已检查的API**:
- ✅ `/api/data/latest-date` - 已添加
- ✅ `/api/data/dates` - 已有
- ✅ `/api/strategies/overview` - 已添加
- ✅ `/api/admin/hero-text` - 已有
- ✅ `/api/admin/status` - 已有

---

## 🧪 测试验证清单

### 功能测试
- [ ] 首页能正确显示最新数据日期
- [ ] 导入新数据后,首页自动显示最新数据(无需刷新浏览器)
- [ ] 登录后显示正确的用户信息
- [ ] 多账号切换不会串号
- [ ] 刷新页面后用户状态保持正确

### 安全测试
- [ ] Cookie的SameSite属性为Strict
- [ ] JWT_SECRET使用强密钥(不是默认值)
- [ ] 管理后台密码已修改(不是admin123456)

### 性能测试
- [ ] 首页加载时间 < 3秒
- [ ] API响应时间 < 500ms
- [ ] 无内存泄漏(使用`pm2 monit`监控)

---

## 📊 问题对比: 本地 vs 生产环境

| 问题 | 本地环境 | 生产环境 | 原因 |
|------|---------|---------|------|
| API数据不更新 | ✅ 正常 | ❌ 缓存旧数据 | 缺少`force-dynamic` |
| 登录串号 | ✅ 正常 | ❌ 显示错误账号 | Cookie SameSite + JWT密钥 |
| 数据库为空 | ❌ 表不存在 | ✅ 有数据 | Git操作覆盖 |
| 环境变量 | ⚠️ 相对路径 | ❌ 必须绝对路径 | standalone模式 |

---

## 🚀 下一步建议

1. **立即部署修复到生产环境**
2. **添加自动化测试**确保API返回最新数据
3. **监控生产环境日志**及时发现异常
4. **定期备份数据库**防止数据丢失
5. **建立测试环境**在部署前充分验证
