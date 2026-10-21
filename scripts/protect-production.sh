#!/bin/bash
# protect-production.sh
# 生产环境保护检查脚本
# 使用方法：source scripts/protect-production.sh

echo "🛡️  生产环境保护检查"
echo "================================"

# 1. 检查当前目录
CURRENT_DIR=$(pwd)

if [[ "$CURRENT_DIR" == *"/var/www/my-app-test"* ]]; then
    echo "✅ 当前在测试环境"
    echo "   目录: $CURRENT_DIR"
    echo "   可以安全操作（导入测试数据、修改配置等）"
    exit 0
fi

if [[ "$CURRENT_DIR" == *"/var/www/my-app"* ]] && [[ "$CURRENT_DIR" != *"/var/www/my-app-test"* ]]; then
    echo "🔴 警告：当前在生产环境！"
    echo ""
    echo "   目录: $CURRENT_DIR"
    echo "   环境: PRODUCTION"
    echo ""
    
    # 检查数据库路径
    if [ -f "ecosystem.config.js" ]; then
        DB_URL=$(grep DATABASE_URL ecosystem.config.js | grep -o "file:[^',]*" | head -1)
        echo "   数据库: $DB_URL"
    fi
    
    echo ""
    echo "⚠️  以下操作需要特别谨慎："
    echo "   ❌ 导入测试数据"
    echo "   ❌ 执行 DELETE/DROP 操作"
    echo "   ❌ 修改表结构 (ALTER TABLE)"
    echo "   ❌ 随意重启服务"
    echo "   ❌ 清理数据"
    echo ""
    
    # 检查是否有备份
    if [ -d "backups" ]; then
        LATEST_BACKUP=$(ls -t backups/*.backup 2>/dev/null | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            echo "✅ 找到最新备份: $LATEST_BACKUP"
            echo "   时间: $(stat -c %y "$LATEST_BACKUP" 2>/dev/null | cut -d. -f1)"
        else
            echo "⚠️  未找到备份文件，请先执行备份！"
        fi
    else
        echo "⚠️  未找到备份目录！"
        echo "   建议先运行: sudo bash scripts/backup-before-upgrade.sh"
    fi
    
    echo ""
    
    # 要求确认
    read -p "⚠️  确认要继续在生产环境操作吗？(输入 yes 继续): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "❌ 操作已取消"
        echo "   如需测试，请切换到测试环境: cd /var/www/my-app-test"
        return 1 2>/dev/null || exit 1
    fi
    
    echo "✅ 已确认，请谨慎操作！"
    echo ""
    echo "建议操作前执行："
    echo "   sudo bash scripts/backup-before-upgrade.sh"
    
    exit 0
fi

# 3. 其他目录
echo "ℹ️  当前不在项目目录"
echo "   目录: $CURRENT_DIR"
exit 1
