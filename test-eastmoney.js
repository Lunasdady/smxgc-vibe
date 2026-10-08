/**
 * 测试东方财富API适配器
 */

import { 
  fetchIndexDataFromEastMoney, 
  convertToDatabaseFormat,
  getIndexName 
} from '@/lib/eastmoney-adapter';

async function testEastMoneyAPI() {
  console.log('=== 测试东方财富API ===\n');

  const testCases = [
    { indexCode: '000300.SH', name: '沪深300' },
    { indexCode: '000905.SH', name: '中证500' },
    { indexCode: '000852.SH', name: '中证1000' },
    { indexCode: '932000.SH', name: '中证2000' },
    { indexCode: '000688.SH', name: '科创50' },
  ];

  const startDate = '2024-09-01';
  const endDate = '2024-09-30';

  let successCount = 0;
  let totalDataPoints = 0;

  for (const testCase of testCases) {
    try {
      console.log(`\n测试: ${testCase.name} (${testCase.indexCode})`);
      console.log(`日期范围: ${startDate} ~ ${endDate}`);

      // 获取数据
      const data = await fetchIndexDataFromEastMoney(
        testCase.indexCode,
        startDate,
        endDate
      );

      console.log(`✅ 成功获取 ${data.length} 条数据`);

      if (data.length > 0) {
        console.log(`最新数据:`);
        const latest = data[data.length - 1];
        console.log(`  日期: ${latest.date}`);
        console.log(`  收盘价: ${latest.close}`);
        console.log(`  涨跌幅: ${latest.changePercent}%`);

        // 转换格式
        const dbData = convertToDatabaseFormat(testCase.indexCode, data);
        console.log(`  转换后: ${dbData.length} 条`);
        if (dbData.length > 0) {
          const latestDb = dbData[dbData.length - 1];
          console.log(`  日收益率: ${latestDb.dailyReturn}%`);
        }

        successCount++;
        totalDataPoints += data.length;
      } else {
        console.log(`⚠️ 无数据`);
      }

      // 间隔
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ 失败:`, error);
    }
  }

  console.log('\n=== 测试总结 ===');
  console.log(`成功: ${successCount}/${testCases.length}`);
  console.log(`总数据点: ${totalDataPoints}`);
  console.log(`成功率: ${((successCount / testCases.length) * 100).toFixed(1)}%`);
}

// 运行测试
testEastMoneyAPI().catch(console.error);
