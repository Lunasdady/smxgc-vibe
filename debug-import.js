const XLSX = require('xlsx');
const fs = require('fs');

// 查找上传的 Excel 文件
const findExcelFile = () => {
  const paths = ['/tmp', '/var/www/my-app'];
  for (const dir of paths) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
      if (files.length > 0) return `${dir}/${files[0]}`;
    } catch(e) {}
  }
  return null;
};

const filePath = findExcelFile();
if (!filePath) {
  console.log('❌ 找不到 Excel 文件');
  process.exit(1);
}

console.log('📁 找到文件:', filePath);

const workbook = XLSX.readFile(filePath);
console.log('\n📊 Sheet 列表:', workbook.SheetNames);

workbook.SheetNames.slice(0, 2).forEach((sheetName, i) => {
  console.log(`\n--- Sheet ${i + 1}: "${sheetName}" ---`);
  
  const worksheet = workbook.Sheets[sheetName];
  
  // 方法1: 用 range: 1（代码中的方式）
  const data1 = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1 });
  console.log('方法1 (range:1) 行数:', data1.length);
  if (data1.length > 0) {
    console.log('Headers:', JSON.stringify(data1[0].slice(0, 8)));
    console.log('是否包含"产品名称":', data1[0].includes('产品名称'));
    console.log('第1条数据前5列:', JSON.stringify(data1[1]?.slice(0, 5)));
  }
  
  // 方法2: 用 range: 2（跳过双层表头）
  const data2 = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 });
  console.log('方法2 (range:2) 行数:', data2.length);
  if (data2.length > 0) {
    console.log('Headers:', JSON.stringify(data2[0].slice(0, 8)));
    console.log('是否包含"产品名称":', data2[0].includes('产品名称'));
  }
});
