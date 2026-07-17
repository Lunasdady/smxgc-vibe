---
name: deploy-production
description: 自动化部署Next.js应用到生产环境或测试环境,包含Nginx配置验证、环境变量检查、数据库同步、构建部署、缓存清除验证。使用场景:部署到生产环境、更新测试环境、服务器初始化部署、排查部署问题时参考标准流程。
---

# 生产环境部署Skill

自动化部署Next.js应用到云服务器,包含完整的验证流程,避免常见的部署陷阱。

## 部署前检查清单

在执行部署前,必须验证以下项目:

- [ ] Nginx的 `sites-enabled` 软链接指向正确配置文件
- [ ] `.env` 文件存在且包含所有必需环境变量
- [ ] 数据库schema与Prisma模型同步
- [ ] 目标服务器目录可访问
- [ ] PM2进程管理工具已安装

## 环境选择

根据部署目标选择对应的配置:

### 生产环境
- **目录**: `/var/www/my-app`
- **端口**: `3002`
- **分支**: `master`
- **PM2进程名**: `smxgc-vibe`
- **数据库**: `/var/www/my-app/prisma/dev.db`

### 测试环境
- **目录**: `/var/www/my-app-test`
- **端口**: `7371`
- **分支**: `develop`
- **PM2进程名**: `smxgc-vibe-test`
- **数据库**: `/var/www/my-app-test/prisma/dev.db`

## 完整部署流程

### 第1步: 连接服务器并进入目录

```bash
ssh user@your-server-ip
cd /var/www/my-app  # 或 /var/www/my-app-test
```

### 第2步: 验证Nginx配置

```bash
# 检查sites-enabled链接是否正确
ls -la /etc/nginx/sites-enabled/

# 必须看到default配置,而不是旧配置
# 错误示例: my-app -> /etc/nginx/sites-available/my-app
# 正确示例: default -> /etc/nginx/sites-available/default
```

**如果链接错误,立即修复:**
```bash
sudo rm /etc/nginx/sites-enabled/my-app
sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 第3步: 拉取最新代码

```bash
git pull origin master  # 生产环境
# 或
git pull origin develop  # 测试环境
```

### 第4步: 检查.env文件

```bash
# 验证.env文件存在
ls -la .env

# 如果不存在,必须创建(见下方.env模板)
```

### 第5步: 同步数据库

```bash
npx prisma db push
npx prisma generate
```

### 第6步: 清理并构建

```bash
rm -rf .next
npm run build
```

### 第7步: 复制必要文件到standalone

```bash
# 复制静态资源
cp -r .next/static .next/standalone/.next/

# 复制环境变量(关键!)
cp .env .next/standalone/

# 复制pages目录(包含_error.js)
mkdir -p .next/standalone/.next/server/pages
cp -r .next/server/pages/* .next/standalone/.next/server/pages/ 2>/dev/null || true
```

### 第8步: 重启服务

```bash
# 生产环境
PORT=3002 pm2 restart smxgc-vibe

# 测试环境
PORT=7371 pm2 restart smxgc-vibe-test

# 保存PM2配置
pm2 save
```

### 第9步: 等待并验证

```bash
sleep 5

# 测试本地访问
curl -s -o /dev/null -w "HTTP状态码: %{http_code}\n" http://localhost:3002

# 检查PM2状态
pm2 list

# 测试API
curl -s http://localhost:3002/api/admin/status | python3 -m json.tool
```

### 第10步: 验证浏览器缓存已清除(关键!)

**这是之前部署失败的主要原因!**

1. 访问生产URL: `http://your-server-ip`
2. 按F12打开开发者工具
3. 切换到Network标签
4. 刷新页面
5. **检查JS文件的build ID**:
   - 查看 `_next/static/chunks/` 下的JS文件名
   - 确认包含新的build ID(时间戳)
   - 如果仍是旧的build ID,说明缓存未清除

**如果缓存未清除:**
- 在浏览器按 `Ctrl+Shift+Delete`
- 选择"全部时间"
- 勾选"缓存的图像和文件"
- 点击"清除数据"
- 或使用无痕模式验证

## .env文件模板

```bash
DATABASE_URL="file:/var/www/my-app/prisma/dev.db"
JWT_SECRET="your-jwt-secret-key-change-this-in-production"
ADMIN_PASSWORD="habtot-mevxop-5Qekbu"
SMTP_HOST="smtp.163.com"
SMTP_PORT="465"
SMTP_USER="smxgc_nav_sever@163.com"
SMTP_PASS="LEgFszv7RxdtfCsK"
NEXT_PUBLIC_API_URL="http://122.51.51.46"
```

**注意**: DATABASE_URL必须使用绝对路径!

## 常见问题排查

### 问题1: API返回500错误
**原因**: `.env`文件缺失或DATABASE_URL配置错误
**解决**: 
```bash
cat .env | grep DATABASE_URL
# 确认使用绝对路径: file:/var/www/my-app/prisma/dev.db
```

### 问题2: 页面显示异常(图标变大/数据为空)
**原因**: 浏览器强缓存未清除
**解决**: 清除浏览器缓存,使用F12验证JS文件版本

### 问题3: Prisma报错列不存在
**原因**: 数据库schema未同步
**解决**: `npx prisma db push`

### 问题4: Nginx返回旧页面
**原因**: sites-enabled链接了旧配置文件
**解决**: 检查并修正软链接

## 自动化部署脚本

使用 `scripts/deploy.sh` 脚本可以一键完成部署:

```bash
# 生产环境部署
bash scripts/deploy.sh production

# 测试环境部署
bash scripts/deploy.sh test
```

脚本会自动执行:
1. 验证Nginx配置
2. 检查.env文件
3. 拉取代码
4. 同步数据库
5. 构建应用
6. 复制文件
7. 重启服务
8. 验证部署

## 部署后验证清单

部署完成后,必须执行以下验证:

- [ ] HTTP状态码返回200
- [ ] PM2进程状态为online
- [ ] API正常返回数据
- [ ] 浏览器F12确认加载的是新版本JS
- [ ] 核心功能测试通过(登录、数据展示)
- [ ] Nginx错误日志无异常: `tail -n 20 /var/log/nginx/error.log`

## 回滚方案

如果部署失败,快速回滚:

```bash
# 1. 停止当前服务
pm2 stop smxgc-vibe

# 2. 检查Git历史
git log --oneline -5

# 3. 回退到上一个版本
git reset --hard HEAD~1

# 4. 重新构建
rm -rf .next && npm run build
cp -r .next/static .next/standalone/.next/
cp .env .next/standalone/

# 5. 重启服务
PORT=3002 pm2 restart smxgc-vibe
```

## 关键教训

1. **永远不要假设部署成功** - 必须实际验证每个步骤
2. **Nginx配置以sites-enabled为准** - 修改sites-available后必须确认链接正确
3. **浏览器缓存是最大陷阱** - 部署后必须用F12验证资源版本
4. **.env文件不会自动创建** - Git不追踪,必须手动创建
5. **数据库必须同步** - schema变更后立即执行db push
