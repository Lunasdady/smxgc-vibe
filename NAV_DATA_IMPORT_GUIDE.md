# 净值数据导入指南

**日期**: 2026-09-20  
**问题**: NavData表为空，日期筛选器显示"暂无数据"  
**状态**: 📝 需要导入数据

---

## 📊 当前数据库状态

### 表结构（18个表）

| 表名 | 记录数 | 说明 |
|------|--------|------|
| FundProduct | 2,736 | 产品汇总数据（4个日期） |
| **NavData** | **0** | **每日净值数据（空）** |
| StrategyMapping | ? | 策略映射表 |
| StrategyDictionary | ? | 策略字典表 |
| IndexData | ? | 指数数据表 |
| IndexMapping | ? | 指数映射表 |
| EmailParseResult | ? | 邮件解析结果 |
| 其他表 | ... | 系统配置等 |

### 问题根源

**NavData表为空**，因为：
1. ✅ 表结构已创建（通过Prisma迁移）
2. ❌ 但没有任何净值数据导入
3. ❌ 邮件解析系统未运行或解析结果未导入

---

## 🎯 需求回顾

根据 `STRATEGY_DISPLAY_REQUIREMENTS.md`：

### 3.2 净值数据筛选

**仅展示**满足以下条件的净值数据：
1. 净值日期（navDate）为**周五**的数据
2. 产品属于"观察池"分类

### 实现逻辑

```
日期筛选器应该显示:
- NavData表中所有不重复的周五日期
- 仅限"观察池"产品的净值日期
- 按日期降序排列
```

---

## 📥 导入净值数据的方法

### 方法1: Excel批量导入（推荐）

**适用场景**: 有历史Excel净值数据文件

**Excel格式要求**:

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| productCode | string | ✅ | 产品代码（如 SZA312(总)） |
| productName | string | ✅ | 产品名称 |
| navDate | date | ✅ | 净值日期（YYYY-MM-DD） |
| unitNav | number | ✅ | 单位净值 |
| cumulativeNav | number | ❌ | 累计净值（可选） |
| source | string | ✅ | 数据来源（excel） |
| confidence | string | ✅ | 置信度（high/medium/low） |

**示例数据**:
```csv
productCode,productName,navDate,unitNav,cumulativeNav,source,confidence
SZA312(总),悬铃尊享CTA1号,2026-05-22,1.2345,1.3456,excel,high
SZA312(总),悬铃尊享CTA1号,2026-05-16,1.2300,1.3400,excel,high
```

**导入步骤**:
1. 准备Excel文件
2. 访问管理后台 `/admin/operation`
3. 使用Excel导入功能
4. 新产品自动归类为"观察池"

### 方法2: 邮件解析自动导入

**适用场景**: 邮件箱中有业绩邮件

**工作流程**:
```
邮件系统 → 解析HTML/附件 → 提取净值 → 写入NavData
```

**检查邮件解析状态**:

```bash
# 查看解析结果数量
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM EmailParseResult;"

# 查看最近解析记录
sqlite3 prisma/dev.db "SELECT id, emailSubject, parseTime, status FROM EmailParseResult ORDER BY parseTime DESC LIMIT 10;"
```

**如果EmailParseResult有数据但NavData为空**：
- 可能是解析成功但未写入NavData
- 检查解析逻辑或重新运行导入

### 方法3: 使用测试数据（快速验证）

**适用场景**: 快速测试功能，不需要真实数据

创建测试数据脚本 `insert-test-navdata.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertTestData() {
  console.log('插入测试净值数据...');
  
  // 生成近10个周五的日期
  const fridays = [];
  let date = new Date();
  // 找到最近的周五
  while (date.getDay() !== 5) {
    date.setDate(date.getDate() - 1);
  }
  
  // 生成10个周五
  for (let i = 0; i < 10; i++) {
    fridays.push(new Date(date));
    date.setDate(date.getDate() - 7);
  }
  
  console.log('生成的周五日期:', fridays.map(d => d.toISOString().split('T')[0]));
  
  // 插入测试数据
  let count = 0;
  for (const friday of fridays) {
    await prisma.navData.create({
      data: {
        productCode: 'TEST001',
        productName: '测试产品1号',
        navDate: friday,
        unitNav: 1.0 + Math.random() * 0.5,
        cumulativeNav: 1.0 + Math.random() * 0.6,
        source: 'test',
        confidence: 'high',
      },
    });
    count++;
  }
  
  console.log(`✅ 插入完成: ${count}条净值数据`);
}

insertTestData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

运行：
```bash
node insert-test-navdata.js
```

---

## 🔍 验证数据导入

### 检查NavData表

```bash
# 查看总记录数
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM NavData;"

# 查看所有周五日期
sqlite3 prisma/dev.db "
  SELECT DISTINCT navDate, COUNT(*) as productCount
  FROM NavData
  WHERE navDate IS NOT NULL
  GROUP BY navDate
  ORDER BY navDate DESC;
"

# 检查是否是周五
node -e "
const dates = [/* 从上面查询结果复制 */];
dates.forEach(ts => {
  const date = new Date(ts);
  const isFriday = date.getDay() === 5;
  console.log(\`\${date.toISOString().split('T')[0]} - 周\${'日一二三四五六'[date.getDay()]} \${isFriday ? '✓' : ''}\`);
});
"
```

### 测试API

```bash
# 日期API应该返回周五列表
curl 'http://localhost:3000/api/data/dates'

# 产品走势API
curl 'http://localhost:3000/api/product/trend?productCode=TEST001&months=3'
```

---

## 📋 完整工作流程

### 首次初始化

1. ✅ 数据库表结构已创建
2. ⏳ **导入净值数据**（选择上述方法之一）
3. ⏳ 验证NavData表有数据
4. ⏳ 测试日期筛选器显示周五列表
5. ⏳ 测试产品走势图表

### 日常更新

1. 邮件系统自动解析新邮件
2. 或手动导入Excel文件
3. NavData表自动更新
4. 前端自动显示新日期

---

## 💡 建议方案

### 短期（立即验证功能）

**使用测试数据**快速验证：
```bash
# 运行上面的测试脚本
node insert-test-navdata.js

# 刷新页面
http://localhost:3000
```

**预期效果**：
- 日期筛选器显示10个周五日期
- 可以选择任意日期查看数据
- 产品走势显示净值曲线

### 中期（导入真实数据）

**如果有Excel文件**：
1. 准备历史净值Excel
2. 通过管理后台导入
3. 验证数据完整性

**如果有邮件系统**：
1. 配置邮件解析
2. 运行解析任务
3. 检查NavData表

### 长期（自动化）

1. 邮件系统每日自动解析
2. NavData表自动更新
3. 前端自动显示最新周五

---

## ⚠️ 注意事项

1. **产品代码一致性**
   - NavData.productCode 必须与 StrategyMapping.productCode 一致
   - 否则无法关联策略分类

2. **日期格式**
   - navDate 必须是周五
   - 格式: YYYY-MM-DD

3. **观察池分类**
   - 新产品导入时自动设置为"观察池"
   - 也可在策略维护页面手动修改

4. **数据去重**
   - NavData有唯一约束：(productCode, navDate)
   - 重复导入会自动覆盖（upsert）

---

## 📞 下一步

请选择导入方式：

**选项1**: 我帮您创建测试数据脚本（立即验证）  
**选项2**: 您提供Excel文件，我帮您导入  
**选项3**: 检查邮件解析系统，查看是否有待导入数据

请告诉我您的选择！

---

**文档版本**: v1.0  
**创建时间**: 2026-09-20  
**状态**: 等待数据导入
