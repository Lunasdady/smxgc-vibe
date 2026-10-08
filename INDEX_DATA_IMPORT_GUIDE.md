# 指数数据导入指南

**更新日期**: 2026-09-20  
**状态**: ✅ 可用

---

## 📋 概述

本系统支持两种指数数据导入方式：

1. **API自动同步**（推荐，需要网络访问东方财富）
2. **Excel手动导入**（备用方案）

---

## 方式1: API自动同步

### 使用场景
- 首次初始化数据
- 每日定时更新
- 补充历史数据

### API端点

```
POST /api/index/data
```

### 请求格式

#### 同步单个指数

```json
{
  "indexCode": "000300.SH",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

#### 同步所有指数（推荐）

```json
{
  "syncAll": true,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

### 使用示例

#### cURL

```bash
# 同步所有指数
curl -X POST http://localhost:3000/api/index/data \
  -H "Content-Type: application/json" \
  -d '{
    "syncAll": true,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'
```

#### JavaScript/TypeScript

```typescript
const response = await fetch('/api/index/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    syncAll: true,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  }),
});

const result = await response.json();
console.log(result);
```

### 返回格式

```json
{
  "success": true,
  "message": "同步完成: 成功 5 个，失败 0 个，共 1250 条数据",
  "results": [
    {
      "indexCode": "000300.SH",
      "indexName": "沪深300",
      "syncedDays": 250,
      "success": true
    },
    ...
  ],
  "totalSynced": 1250,
  "successCount": 5,
  "failCount": 0
}
```

### 支持的指数代码

| 指数名称 | 指数代码 | 东方财富代码 |
|---------|---------|-------------|
| 沪深300 | 000300.SH | 1.000300 |
| 中证500 | 000905.SH | 1.000905 |
| 中证1000 | 000852.SH | 1.000852 |
| 中证2000 | 932000.SH | 0.932000 |
| 科创50 | 000688.SH | 0.000688 |

### 常见问题

#### Q1: 网络请求失败

**错误**: `fetch failed` 或 `SocketError`

**原因**: 
- 东方财富API被防火墙阻止
- 网络不可达
- IPv6连接问题

**解决方案**:
1. 检查网络连接
2. 使用方式2（Excel手动导入）
3. 配置代理服务器

#### Q2: 数据为空

**原因**: 日期范围内无交易数据

**解决方案**: 
- 确认日期是交易日
- 扩大日期范围
- 检查日期格式（YYYY-MM-DD）

---

## 方式2: Excel手动导入（备用）

### 使用场景
- API无法访问时
- 批量导入历史数据
- 数据校验和补充

### Excel格式要求

#### 列定义

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| index_code | string | ✅ | 指数代码（如 000300.SH） |
| index_name | string | ✅ | 指数名称（如 沪深300） |
| trade_date | date | ✅ | 交易日期（YYYY-MM-DD） |
| close_price | number | ✅ | 收盘价 |
| daily_return | number | ❌ | 日收益率（%） |

#### 示例数据

```csv
index_code,index_name,trade_date,close_price,daily_return
000300.SH,沪深300,2024-01-01,3500.50,
000300.SH,沪深300,2024-01-02,3520.30,0.57
000300.SH,沪深300,2024-01-03,3510.80,-0.27
```

### 导入工具（待开发）

**计划功能**:
- Excel文件上传
- 数据校验
- 批量导入
- 导入日志

---

## 📊 数据验证

### 查询指数数据

```bash
# 查询所有指数数据
curl 'http://localhost:3000/api/index/data'

# 查询特定指数
curl 'http://localhost:3000/api/index/data?indexCode=000300.SH'

# 查询日期范围
curl 'http://localhost:3000/api/index/data?indexCode=000300.SH&startDate=2024-01-01&endDate=2024-12-31'
```

### 返回格式

```json
{
  "indexData": [
    {
      "id": 1,
      "indexCode": "000300.SH",
      "indexName": "沪深300",
      "tradeDate": "2024-01-01T00:00:00.000Z",
      "closePrice": 3500.50,
      "dailyReturn": null,
      "createdAt": "2024-01-01T10:00:00.000Z"
    },
    ...
  ]
}
```

---

## 🔄 定时同步（可选）

### 方案1: Node.js定时任务

创建 `scripts/sync-index-data.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncAllIndexData() {
  console.log('开始同步指数数据...');
  
  const response = await fetch('http://localhost:3000/api/index/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      syncAll: true,
      startDate: '2024-01-01',
      endDate: new Date().toISOString().split('T')[0],
    }),
  });
  
  const result = await response.json();
  console.log('同步结果:', result);
}

// 运行
syncAllIndexData().catch(console.error);
```

### 方案2: Cron定时任务

```bash
# 每天18:00同步
0 18 * * * cd /path/to/project && npx tsx scripts/sync-index-data.ts >> /var/log/index-sync.log 2>&1
```

---

## 🎯 最佳实践

### 1. 首次同步

```bash
# 同步近1年数据
curl -X POST http://localhost:3000/api/index/data \
  -H "Content-Type: application/json" \
  -d '{
    "syncAll": true,
    "startDate": "2025-09-20",
    "endDate": "2026-09-20"
  }'
```

### 2. 每日更新

```bash
# 同步近7天数据（包含周末补数据）
curl -X POST http://localhost:3000/api/index/data \
  -H "Content-Type: application/json" \
  -d '{
    "syncAll": true,
    "startDate": "2026-09-13",
    "endDate": "2026-09-20"
  }'
```

### 3. 数据校验

```bash
# 查询最新数据
curl 'http://localhost:3000/api/index/data?indexCode=000300.SH' | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
latest = data['indexData'][-1]
print(f'最新日期: {latest[\"tradeDate\"]}')
print(f'收盘价: {latest[\"closePrice\"]}')
print(f'数据条数: {len(data[\"indexData\"])}')
"
```

---

## ⚠️ 注意事项

1. **频率限制**: 东方财富API有频率限制，建议每次同步间隔300ms
2. **交易日**: 非交易日无数据，API会自动跳过
3. **数据量**: 单次同步建议不超过1000条（约4年交易日）
4. **幂等性**: 支持重复同步，使用upsert避免重复数据
5. **错误处理**: 部分指数可能失败，检查返回结果的success字段

---

## 📞 技术支持

如有问题，请检查：
1. 网络连接是否正常
2. 数据库是否运行
3. 指数映射是否正确（IndexMapping表）
4. 日志输出（控制台）

---

**文档版本**: v1.0  
**最后更新**: 2026-09-20
