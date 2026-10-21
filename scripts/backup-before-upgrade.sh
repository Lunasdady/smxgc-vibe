#!/bin/bash
# backup-before-upgrade.sh
# 升级前自动备份数据库和用户权限数据
# 使用方法：sudo bash scripts/backup-before-upgrade.sh

set -e  # 遇到错误立即退出

echo "📦 开始备份生产环境数据..."
echo "================================"

# 配置
BACKUP_DIR="/var/www/my-app/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PATH="/var/www/my-app/dev.db"
PROJECT_DIR="/var/www/my-app"

# 检查权限
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    echo "   sudo bash scripts/backup-before-upgrade.sh"
    exit 1
fi

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "❌ 数据库文件不存在: $DB_PATH"
    exit 1
fi

# 创建备份目录
echo "📁 创建备份目录: $BACKUP_DIR"
mkdir -p $BACKUP_DIR

# 1. 备份数据库
echo ""
echo "1️⃣  备份数据库..."
cp $DB_PATH $BACKUP_DIR/dev.db.$TIMESTAMP.backup
BACKUP_SIZE=$(du -h $BACKUP_DIR/dev.db.$TIMESTAMP.backup | cut -f1)
echo "   ✅ 数据库备份完成: $BACKUP_SIZE"

# 2. 备份用户权限数据（User 表）
echo ""
echo "2️⃣  备份用户权限数据..."
sqlite3 $DB_PATH ".dump User" > $BACKUP_DIR/users.$TIMESTAMP.sql
USER_COUNT=$(sqlite3 $DB_PATH "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
echo "   ✅ 用户数据备份完成: $USER_COUNT 条记录"

# 3. 备份访问日志（AccessLog 表）
echo ""
echo "3️⃣  备份访问日志..."
sqlite3 $DB_PATH ".dump AccessLog" > $BACKUP_DIR/accesslog.$TIMESTAMP.sql 2>/dev/null || echo "   ⚠️  AccessLog 表不存在，跳过"
echo "   ✅ 访问日志备份完成"

# 4. 备份当前代码版本信息
echo ""
echo "4️⃣  备份代码版本信息..."
cd $PROJECT_DIR
git log --oneline -1 > $BACKUP_DIR/git-version.$TIMESTAMP.txt
git log --oneline -5 >> $BACKUP_DIR/git-version.$TIMESTAMP.txt
echo "   ✅ 代码版本备份完成"

# 5. 显示备份文件列表
echo ""
echo "📋 备份文件列表:"
ls -lh $BACKUP_DIR/*.$TIMESTAMP.* | while read line; do
    echo "   $line"
done

# 6. 生成备份摘要
echo ""
echo "📊 备份摘要:"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "   数据库大小: $(du -h $DB_PATH | cut -f1)"
echo "   用户数量: $USER_COUNT"
echo "   最新数据日期: $(sqlite3 $DB_PATH "SELECT date(MAX(dataDate)/1000, 'unixepoch') FROM fundProduct;" 2>/dev/null || echo 'N/A')"

# 7. 显示回滚命令
echo ""
echo "🔄 如需回滚，执行以下命令："
echo "   sudo cp $BACKUP_DIR/dev.db.$TIMESTAMP.backup $DB_PATH"
echo "   sqlite3 $DB_PATH < $BACKUP_DIR/users.$TIMESTAMP.sql"

echo ""
echo "================================"
echo "✅ 备份完成！可以安全升级。"
echo ""
echo "⚠️  重要提示："
echo "   - 备份文件保存在: $BACKUP_DIR"
echo "   - 升级前请确认备份成功"
echo "   - 如有问题可立即回滚"
