import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * 下载手工维护净值数据的 Excel 模板
 */
export async function GET() {
  try {
    // 创建示例数据
    const templateData = [
      {
        '产品代码': 'SQU707',
        '产品名称': '展弘多策略10号私募证券投资基金',
        '净值日期': '2026-10-09',
        '单位净值': 1.2345,
        '累计净值': 1.3456,
      },
      {
        '产品代码': 'SSC335',
        '产品名称': '禾永锐进1号私募证券投资基金',
        '净值日期': '2026-10-09',
        '单位净值': 1.1234,
        '累计净值': 1.2345,
      },
    ];

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '手工净值数据模板');

    // 设置列宽
    ws['!cols'] = [
      { wch: 12 },  // 产品代码
      { wch: 40 },  // 产品名称
      { wch: 12 },  // 净值日期
      { wch: 12 },  // 单位净值
      { wch: 12 },  // 累计净值
    ];

    // 生成 Buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 返回文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="manual_nav_template.xlsx"',
      },
    });
  } catch (error) {
    console.error('生成模板失败:', error);
    return NextResponse.json(
      { error: '生成模板失败' },
      { status: 500 }
    );
  }
}
