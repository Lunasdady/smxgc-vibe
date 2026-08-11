import Imap from 'imap';
import prisma from '@/lib/db';
import { decrypt } from './crypto';
import { parseHtmlTables, findNavTable, parseHtmlKeyValue } from './html-parser';
import { parseExcelBuffer, findNavSheet } from './excel-parser-enhanced';
import { mapRowFields } from './field-mapper';
import { cleanNavData } from './data-cleaner';
import { isNavEmail } from './rules';
import { simpleParser } from 'mailparser';

export interface ParseProgress {
  progress: number;
  total: number;
  current: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

export interface ParseResult {
  success: boolean;
  total?: number;
  processed?: number;
  successCount?: number;
  failedCount?: number;
  skippedCount?: number;
  message?: string;
}

export interface ParseOptions {
  fullParse?: boolean; // 是否全量解析
  testLimit?: number; // 测试解析限制数量
}

/**
 * 解析单个邮箱配置
 */
export async function parseEmailConfig(
  configId: number,
  onProgress?: (progress: ParseProgress) => void,
  options?: ParseOptions
): Promise<ParseResult> {
  const config = await prisma.emailConfig.findUnique({
    where: { id: configId },
  });
  
  if (!config) {
    return { success: false, message: '邮箱配置不存在' };
  }
  
  const password = decrypt(config.passwordEncrypted);
  
  return new Promise((resolve) => {
    const imap = new Imap({
      user: config.email,
      password,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.sslEnabled,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 30000,
      connTimeout: 30000,
    });
    
    const result: ParseResult = {
      success: false,
      total: 0,
      processed: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
    };
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, async (err: any) => {
        if (err) {
          imap.end();
          resolve({ success: false, message: `打开邮箱失败: ${err.message}` });
          return;
        }
        
        try {
          // 搜索邮件
          const searchCriteria: any[] = [];
          
          if (options?.fullParse) {
            // 全量解析: 解析所有邮件
            onProgress?.({
              progress: 0,
              total: 0,
              current: 0,
              status: 'processing',
              message: '正在获取邮件总数...',
            });
            
            // 先获取所有邮件
            imap.search(['ALL'], async (err: any, allUids: number[]) => {
              if (err) {
                imap.end();
                resolve({ success: false, message: `搜索邮件失败: ${err.message}` });
                return;
              }
              
              if (!allUids || allUids.length === 0) {
                imap.end();
                resolve({ success: true, message: '邮箱中没有邮件', total: 0, processed: 0 });
                return;
              }
              
              result.total = allUids.length;
              
              onProgress?.({
                progress: 0,
                total: allUids.length,
                current: 0,
                status: 'processing',
                message: `找到 ${allUids.length} 封邮件,开始解析...`,
              });
              
              await processEmailBatch(imap, allUids, config.id, configId, result, onProgress);
              
              // 全量解析也更新lastParsedUid
              const maxUid = Math.max(...allUids);
              await prisma.emailConfig.update({
                where: { id: configId },
                data: {
                  lastParsedAt: new Date(),
                  lastParsedUid: String(maxUid),
                },
              });
              
              imap.end();
              result.success = true;
              result.message = `全量解析完成: 成功 ${result.successCount} 封, 失败 ${result.failedCount} 封, 跳过 ${result.skippedCount} 封`;
              resolve(result);
            });
          } else {
            // 测试解析: 只解析最新N封邮件
            if (options?.testLimit) {
              onProgress?.({
                progress: 0,
                total: 0,
                current: 0,
                status: 'processing',
                message: `正在获取最新 ${options.testLimit} 封邮件...`,
              });
              
              // 获取所有邮件,然后取最新的N封
              imap.search(['ALL'], async (err: any, allUids: number[]) => {
                if (err) {
                  imap.end();
                  resolve({ success: false, message: `搜索邮件失败: ${err.message}` });
                  return;
                }
                
                if (!allUids || allUids.length === 0) {
                  imap.end();
                  resolve({ success: true, message: '邮箱中没有邮件', total: 0, processed: 0 });
                  return;
                }
                
                // 取最新的N封(UID越大越新)
                const sortedUids = allUids.sort((a, b) => b - a);
                const testUids = sortedUids.slice(0, options.testLimit!);
                
                result.total = testUids.length;
                
                onProgress?.({
                  progress: 0,
                  total: testUids.length,
                  current: 0,
                  status: 'processing',
                  message: `找到 ${allUids.length} 封邮件,测试解析最新 ${testUids.length} 封...`,
                });
                
                await processEmailBatch(imap, testUids, config.id, configId, result, onProgress);
                
                // 不更新lastParsedUid(测试模式)
                
                imap.end();
                result.success = true;
                result.message = `测试解析完成: 成功 ${result.successCount} 封, 失败 ${result.failedCount} 封, 跳过 ${result.skippedCount} 封`;
                resolve(result);
              });
            } else {
              // 增量解析: 只解析未读邮件
              searchCriteria.push('UNSEEN');
              if (config.lastParsedUid) {
                searchCriteria.push(['UID', `${config.lastParsedUid}:*`]);
              }
              
              imap.search(searchCriteria, async (err: any, uids: number[]) => {
                if (err) {
                  imap.end();
                  resolve({ success: false, message: `搜索邮件失败: ${err.message}` });
                  return;
                }
                
                if (!uids || uids.length === 0) {
                  imap.end();
                  resolve({ success: true, message: '没有新邮件', total: 0, processed: 0 });
                  return;
                }
                
                result.total = uids.length;
                
                await processEmailBatch(imap, uids, config.id, configId, result, onProgress);
                
                // 更新最后解析UID
                const maxUid = Math.max(...uids);
                await prisma.emailConfig.update({
                  where: { id: configId },
                  data: {
                    lastParsedAt: new Date(),
                    lastParsedUid: String(maxUid),
                  },
                });
                
                imap.end();
                result.success = true;
                result.message = `增量解析完成: 成功 ${result.successCount} 封, 失败 ${result.failedCount} 封, 跳过 ${result.skippedCount} 封`;
                resolve(result);
              });
            }
          }
        } catch (error: any) {
          imap.end();
          resolve({ success: false, message: `解析异常: ${error.message}` });
        }
      });
    });
    
    imap.once('error', (err: Error) => {
      resolve({ success: false, message: `IMAP连接错误: ${err.message}` });
    });
    
    imap.connect();
  });
}

/**
 * 批量处理邮件
 */
async function processEmailBatch(
  imap: Imap,
  uids: number[],
  boxId: number,
  configId: number,
  result: ParseResult,
  onProgress?: (progress: ParseProgress) => void
): Promise<void> {
  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    
    onProgress?.({
      progress: Math.round(((i + 1) / uids.length) * 100),
      total: uids.length,
      current: i + 1,
      status: 'processing',
      message: `正在解析第 ${i + 1}/${uids.length} 封邮件...`,
    });
    
    try {
      await processSingleEmail(imap, uid, configId);
      result.successCount = (result.successCount || 0) + 1;
    } catch (error: any) {
      if (error.message === '非净值邮件') {
        result.skippedCount = (result.skippedCount || 0) + 1;
      } else {
        console.error(`处理邮件 ${uid} 失败:`, error);
        result.failedCount = (result.failedCount || 0) + 1;
      }
    }
    
    result.processed = i + 1;
  }
}

/**
 * 处理单封邮件
 */
async function processSingleEmail(
  imap: Imap,
  uid: number,
  emailConfigId: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const f = imap.fetch([uid], { bodies: '' });
    
    // 初始化解析日志
    const parseLog: any = {
      emailUid: String(uid),
      emailConfigId,
      subject: '',
      hasAttachments: false,
      attachmentCount: 0,
      attachmentTypes: [],
      attachmentFilenames: [],
      hasHtml: false,
      htmlLength: 0,
      parseAttempts: {},
      parseResults: {},
      errorReason: null,
      errorDetails: null,
    };
    
    f.on('message', (msg: any) => {
      let buffer = '';
      
      msg.on('body', (stream: any) => {
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
        });
        
        stream.once('end', async () => {
          try {
            // 使用simpleParser解析邮件
            const parsed = await simpleParser(buffer);
            
            const subject = parsed.subject || '';
            const from = parsed.from?.text || '';
            const date = parsed.date || new Date();
            
            // 记录邮件基本信息
            parseLog.subject = subject;
            parseLog.hasHtml = !!parsed.html;
            parseLog.htmlLength = parsed.html?.length || 0;
            
            // 记录附件信息
            if (parsed.attachments && parsed.attachments.length > 0) {
              parseLog.hasAttachments = true;
              parseLog.attachmentCount = parsed.attachments.length;
              parseLog.attachmentTypes = parsed.attachments.map((a: any) => a.contentType || 'unknown');
              parseLog.attachmentFilenames = parsed.attachments.map((a: any) => a.filename || 'unnamed');
              
              console.log(`📎 邮件 ${uid} 有 ${parsed.attachments.length} 个附件:`);
              parsed.attachments.forEach((att: any, idx: number) => {
                console.log(`  ${idx + 1}. ${att.filename || 'unnamed'} (${att.contentType}) - ${att.size} bytes`);
              });
            } else {
              console.log(`📎 邮件 ${uid} 没有附件`);
            }
            
            // 检查是否为净值邮件
            if (!isNavEmail(subject)) {
              // 记录为非净值邮件
              await prisma.emailParseResult.create({
                data: {
                  emailUid: String(uid),
                  subject,
                  fromEmail: from,
                  sentDate: date,
                  receivedAt: new Date(),
                  emailConfigId,
                  parseStatus: 'skipped',
                  recordCount: 0,
                  errorReason: '非净值邮件',
                },
              });
              resolve();
              return;
            }
            
            // 解析HTML内容
            let htmlParsed = false;
            let excelParsed = false;
            let recordCount = 0;
            let errorReason: string | null = null;
            let savedRows: Record<string, string>[] = [];
            let source: 'html' | 'excel' | 'vertical' = 'html';
            let htmlRows: Record<string, string>[] = []; // 🚨 保存HTML解析结果
            
            // 🚨 策略1: 优先解析HTML正文(格式更清晰,解析可靠性更高)
            // 🚨 修复: 正确判断HTML是否为空(空字符串也应该视为无HTML)
            const htmlContent = typeof parsed.html === 'string' ? parsed.html : parsed.html?.toString();
            if (htmlContent && htmlContent.trim().length > 0) {
              console.log(`\n📄 开始HTML解析 (长度: ${htmlContent.length} 字符)...`);
              parseLog.parseAttempts.html = true;
              
              // 策略1a: 先尝试解析HTML表格
              const tables = parseHtmlTables(htmlContent);
              console.log(`📋 发现 ${tables.length} 个HTML表格`);
              
              parseLog.parseResults.htmlTables = {
                tableCount: tables.length,
                tables: tables.map((t: any) => ({
                  headers: t.headers,
                  rowCount: t.rows.length,
                })),
              };
              
              const navTable = findNavTable(tables);
              
              if (navTable) {
                htmlRows = navTable.rows;
                htmlParsed = true;
                recordCount += navTable.rows.length;
                console.log(`✅ HTML表格解析成功: ${navTable.rows.length} 条记录`);
                
                parseLog.parseResults.htmlTable = {
                  found: true,
                  rowCount: navTable.rows.length,
                  headers: navTable.headers,
                };
              } else {
                // 策略1b: 尝试解析纵向键值对(用于资产净值公告)
                console.log(`📋 尝试解析HTML纵向键值对...`);
                parseLog.parseAttempts.htmlKeyValue = true;
                
                const kvRecord = parseHtmlKeyValue(htmlContent);
                
                if (kvRecord) {
                  htmlRows = [kvRecord];
                  htmlParsed = true;
                  recordCount = 1;
                  console.log(`✅ HTML纵向解析成功: 1 条记录`);
                  
                  parseLog.parseResults.htmlKeyValue = {
                    found: true,
                    record: kvRecord,
                  };
                } else {
                  console.log(`⚠️ HTML解析失败: 未找到表格或纵向数据`);
                  parseLog.parseResults.htmlKeyValue = { found: false };
                }
              }
              
              // 🚨 关键: 验证HTML数据是否能落库
              // 🚨 修复: 即使htmlRows为空,也应该尝试Excel附件
              if (htmlRows.length > 0) {
                console.log(`\n🔍 验证HTML数据是否能落库...`);
                const canSaveCount = validateRowsCanSave(htmlRows);
                console.log(`📊 HTML数据验证结果: ${canSaveCount}/${htmlRows.length} 行可以落库`);
                
                if (canSaveCount > 0) {
                  savedRows = htmlRows;
                  source = 'html';
                  console.log(`✅ HTML数据验证通过，优先使用HTML数据\n`);
                } else {
                  console.log(`⚠️ HTML数据无法落库，准备回退到Excel附件\n`);
                  savedRows = []; // 清空，准备尝试Excel
                  htmlParsed = false; // 🚨 标记HTML解析实际失败
                }
              } else {
                // 🚨 修复: HTML解析但未提取到数据,标记为失败以便回退Excel
                console.log(`⚠️ HTML解析未提取到数据,准备回退到Excel附件\n`);
                htmlParsed = false;
              }
            } else {
              console.log(`📄 没有HTML正文`);
            }
            
            // 🚨 策略2: 如果HTML解析失败或无法落库,尝试Excel附件
            if (savedRows.length === 0 && parsed.attachments && parsed.attachments.length > 0) {
              console.log(`📎 HTML无法落库，尝试解析 ${parsed.attachments.length} 个附件`);
              for (const attachment of parsed.attachments) {
                // 检查是否为Excel文件
                const filename = attachment.filename || '';
                const isExcel = /\.(xlsx|xls)$/i.test(filename) || 
                               attachment.contentType?.includes('excel') ||
                               attachment.contentType?.includes('spreadsheet');
                
                console.log(`📎 附件: ${filename}, MIME: ${attachment.contentType}, 是Excel: ${isExcel}`);
                
                // 🚨 跳过PDF附件
                if (filename.endsWith('.pdf') || attachment.contentType?.includes('pdf')) {
                  console.log(`⚠️  PDF附件,跳过解析: ${filename}`);
                  continue;
                }
                
                if (isExcel && attachment.content) {
                  try {
                    console.log(`\n📦 开始解析Excel附件: ${filename}`);
                    parseLog.parseAttempts.excel = true;
                    
                    const sheets = parseExcelBuffer(attachment.content as Buffer, subject);
                    console.log(`📊 Excel解析结果: ${sheets.length} 个Sheet`);
                    
                    const navSheet = findNavSheet(sheets);
                    
                    if (navSheet) {
                      console.log(`✅ 找到净值Sheet: ${navSheet.sheetName}, ${navSheet.rows.length} 行`);
                      console.log(`📋 表头: ${navSheet.headers.join(', ')}`);
                      
                      parseLog.parseResults.excel = {
                        found: true,
                        sheetName: navSheet.sheetName,
                        rowCount: navSheet.rows.length,
                        headers: navSheet.headers,
                      };
                      
                      // 🚨 验证Excel数据是否能落库
                      console.log(`\n🔍 验证Excel数据是否能落库...`);
                      const canSaveCount = validateRowsCanSave(navSheet.rows);
                      console.log(`📊 Excel数据验证结果: ${canSaveCount}/${navSheet.rows.length} 行可以落库`);
                      
                      if (canSaveCount > 0) {
                        // 先收集数据,稍后统一保存
                        savedRows = navSheet.rows;
                        source = 'excel';
                        excelParsed = true;
                        recordCount += navSheet.rows.length;
                        console.log(`✅ Excel数据验证通过，使用Excel数据\n`);
                        break; // 🚨 找到可用的Excel，跳出循环
                      } else {
                        console.log(`⚠️ Excel数据无法落库，继续检查其他附件\n`);
                      }
                    } else {
                      console.log(`⚠️ 未找到净值Sheet,所有Sheet如下:`);
                      parseLog.parseResults.excel = {
                        found: false,
                        sheetCount: sheets.length,
                        sheets: sheets.map((s: any) => ({
                          name: s.sheetName,
                          headers: s.headers,
                          rowCount: s.rows.length,
                        })),
                      };
                      
                      sheets.forEach((s, idx) => {
                        console.log(`  Sheet ${idx + 1}: ${s.sheetName}, 表头: [${s.headers.join(', ')}], 行数: ${s.rows.length}`);
                        if (s.rows.length > 0) {
                          console.log(`    第1行: ${JSON.stringify(s.rows[0]).substring(0, 200)}...`);
                        }
                      });
                    }
                  } catch (error: any) {
                    console.error(`❌ Excel解析失败: ${filename}`, error.message);
                    console.error(error.stack);
                    errorReason = `Excel解析失败: ${error.message}`;
                    parseLog.parseResults.excel = { error: error.message };
                  }
                } else if (attachment.content) {
                  console.log(`⚠️ 附件不是Excel格式,跳过: ${filename}`);
                }
              }
            } else if (savedRows.length === 0) {
              console.log(`📎 没有附件,无法尝试Excel解析`);
            } else {
              console.log(`✅ HTML数据可用,跳过Excel附件解析`);
            }
            
            // 🚨 降级策略: 如果Excel和HTML都解析失败,尝试从邮件主题提取基础数据
            if (savedRows.length === 0 && !excelParsed && !htmlParsed) {
              console.log(`🚨 所有解析器都失败,尝试降级策略...`);
              
              // 从邮件主题中提取产品代码、产品名称、日期
              const productCodeMatch = subject.match(/([A-Z]{2,4}\d+[A-Z]*)/);
              // 支持YYYY-MM-DD和YYYYMMDD两种日期格式
              const dateMatch = subject.match(/(\d{4}-\d{2}-\d{2})/) || subject.match(/(\d{8})/);
              
              // 🚨 即使没有产品代码,只要有产品名称或日期,也尝试提取
              if (productCodeMatch || dateMatch || true) { // 总是尝试提取产品名称
                const fallbackRow: Record<string, string> = {};
                
                if (productCodeMatch) {
                  fallbackRow['productCode'] = productCodeMatch[1];
                  console.log(`  📦 从主题提取产品代码: ${productCodeMatch[1]}`);
                }
                
                // 尝试提取产品名称(多种模式)
                // 模式1: "汉马山谷无为稳守型FOF私募证券投资基金"或"银瓴运通对冲套利进取1号证券投资私募基金"
                let productNameMatch = subject.match(/([\u4e00-\u9fa5]{2,}私募[\u4e00-\u9fa5\(\)（）A-Za-z0-9\-]+基金)/);
                
                // 模式2: 如果模式1失败,尝试更宽松的匹配("私募...证券"或"私募...投资")
                if (!productNameMatch) {
                  productNameMatch = subject.match(/([\u4e00-\u9fa5]{2,}私募[\u4e00-\u9fa5\(\)（）A-Za-z0-9\-]*(?:证券|投资|FOF)[\u4e00-\u9fa5\(\)（）A-Za-z0-9\-]*)/);
                }
                
                // 模式3: 如果仍然失败,尝试匹配"_"之间的内容
                if (!productNameMatch) {
                  const underscoreParts = subject.split('_');
                  for (const part of underscoreParts) {
                    if (/[\u4e00-\u9fa5]{2,}(?:私募|基金|证券|投资)/.test(part)) {
                      productNameMatch = [null, part.trim()];
                      break;
                    }
                  }
                }
                
                if (productNameMatch) {
                  fallbackRow['productName'] = productNameMatch[1];
                  console.log(`  📦 从主题提取产品名称: ${productNameMatch[1]}`);
                }
                
                if (dateMatch) {
                  // 转换日期格式: YYYYMMDD -> YYYY-MM-DD
                  let dateStr = dateMatch[1];
                  if (dateStr.length === 8) {
                    dateStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
                  }
                  fallbackRow['navDate'] = dateStr;
                  console.log(`  📦 从主题提取日期: ${dateStr}`);
                }
                
                // 🚨 关键: 如果没有产品代码,但有产品名称,使用产品名称的首字母缩写作为productCode
                if (!fallbackRow['productCode'] && fallbackRow['productName']) {
                  // 对于广西银瓴,无法提取标准产品代码,标记为待定
                  fallbackRow['productCode'] = 'PENDING';
                  console.log(`  ⚠️ 无标准产品代码,标记为PENDING`);
                }
                
                if (Object.keys(fallbackRow).length > 0) {
                  savedRows = [fallbackRow];
                  source = 'html'; // 标记为html来源(虽然是从主题提取)
                  console.log(`✅ 降级策略成功,提取 ${Object.keys(fallbackRow).length} 个字段`);
                }
              }
            }
            
            // 🚨 关键修复: 过滤声明行(日期字段包含"声明")
            if (savedRows.length > 1) {
              const originalCount = savedRows.length;
              savedRows = savedRows.filter(row => {
                const dateField = row['日期'] || row['navDate'] || row['净值日期'];
                if (dateField && typeof dateField === 'string' && dateField.includes('声明')) {
                  console.log(`🚨 过滤声明行: ${dateField.substring(0, 50)}...`);
                  return false;
                }
                return true;
              });
              if (savedRows.length < originalCount) {
                console.log(`✅ 过滤后: ${originalCount}行 → ${savedRows.length}行`);
              }
            }
            
            // 🚨 关键修复: 如果数据中缺少必填字段,尝试从邮件主题中提取
            if (savedRows.length > 0) {
              const firstRow = savedRows[0];
              
              // 1. 提取产品代码（增强版：支持更多模式）
              const hasProductCode = firstRow['productCode'] || firstRow['产品代码'] || firstRow['基金代码'] || firstRow['资产代码'];
              if (!hasProductCode) {
                // 🚨 增强: 支持多种产品代码格式
                // 模式1: 标准格式如 SAFS80, LF505A, SVH514
                let productCodeMatch = subject.match(/([A-Z]{2,6}\d+[A-Z]*)/);
                
                // 模式2: 下划线包围的格式如 _SVH514_
                if (!productCodeMatch) {
                  productCodeMatch = subject.match(/_(LF|SL|SA|SV|ST|SQU|SSL)[A-Z0-9]+_/i);
                }
                
                // 模式3: 如果没有产品代码，但有基金名称，尝试从名称中提取关键词
                if (!productCodeMatch) {
                  const hasProductName = firstRow['productName'] || firstRow['产品名称'] || firstRow['基金名称'];
                  if (hasProductName) {
                    // 提取名称前3个字符作为临时标识（用于去重）
                    const nameKeyword = String(hasProductName).substring(0, 6);
                    console.log(`⚠️ 数据中缺少产品代码,使用基金名称前缀: ${nameKeyword}`);
                    savedRows.forEach(row => {
                      row['productCode'] = nameKeyword;
                    });
                    // 跳过后续的标准匹配
                    productCodeMatch = [null, nameKeyword] as any;
                  }
                }
                
                if (productCodeMatch) {
                  const extractedCode = productCodeMatch[1] || productCodeMatch[0];
                  console.log(`⚠️ 数据中缺少产品代码,从主题中提取: ${extractedCode}`);
                  savedRows.forEach(row => {
                    row['productCode'] = extractedCode;
                  });
                }
              }
              
              // 2. 🚨 新增: 提取日期字段(STF042等邮件中日期在主题而不在表格中)
              const hasNavDate = firstRow['navDate'] || firstRow['日期'] || firstRow['净值日期'] || firstRow['navDate：'];
              if (!hasNavDate) {
                // 匹配日期格式: 2026-07-24 或 20260724
                const dateMatch = subject.match(/(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                  const extractedDate = dateMatch[1];
                  console.log(`⚠️ 数据中缺少日期,从主题中提取: ${extractedDate}`);
                  savedRows.forEach(row => {
                    row['navDate'] = extractedDate;
                  });
                } else {
                  // 尝试匹配YYYYMMDD格式
                  const dateMatch2 = subject.match(/(\d{8})/);
                  if (dateMatch2) {
                    const rawDate = dateMatch2[1];
                    const formattedDate = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
                    console.log(`⚠️ 数据中缺少日期,从主题中提取(YYYYMMDD): ${formattedDate}`);
                    savedRows.forEach(row => {
                      row['navDate'] = formattedDate;
                    });
                  }
                }
              }
            }
            
            // 先保存净值数据(在创建解析结果记录之前)
            let navDataSavedCount = 0;
            if (savedRows.length > 0) {
              navDataSavedCount = await saveNavDataWithResultId(savedRows, source);
            }
            
            // 根据实际落库数量判定成功/失败
            const actualSuccessCount = navDataSavedCount;
            const parseStatus = actualSuccessCount > 0 ? 'success' : 'failed';
            
            // 确定失败原因
            let finalErrorReason = errorReason;
            if (parseStatus === 'failed') {
              if (savedRows.length === 0) {
                finalErrorReason = '未提取到数据行(recordCount=0)';
              } else if (savedRows.length > 0 && navDataSavedCount === 0) {
                finalErrorReason = `数据清洗失败(提取${savedRows.length}行,落库0行)`;
              }
            }
            
            console.log(`📊 解析结果: 提取${savedRows.length}行, 落库${navDataSavedCount}行, 状态: ${parseStatus}`);
            
            // 构建详细的rawData用于诊断
            const detailedRawData = {
              source,
              rowCount: savedRows.length,
              headers: savedRows.length > 0 ? Object.keys(savedRows[0]) : [],
              rows: savedRows.slice(0, 3), // 只保存前3行原始数据
              mappedRows: [], // 映射后的数据
              cleanIssues: [], // 清洗问题
              savedCount: navDataSavedCount,
            };
            
            // 创建解析结果记录
            const parseResult = await prisma.emailParseResult.create({
              data: {
                emailUid: String(uid),
                subject,
                fromEmail: from,
                sentDate: date,
                receivedAt: new Date(),
                emailConfigId,
                htmlParsed,
                excelParsed,
                parseStatus,
                recordCount: savedRows.length,
                errorReason: finalErrorReason,
                rawData: JSON.stringify(detailedRawData),
              },
            });
            
            // 保存解析日志
            parseLog.errorReason = finalErrorReason;
            await prisma.parseLog.create({
              data: {
                emailUid: String(uid),
                subject,
                emailConfigId,
                hasAttachments: parseLog.hasAttachments,
                attachmentCount: parseLog.attachmentCount,
                attachmentTypes: JSON.stringify(parseLog.attachmentTypes),
                attachmentFilenames: JSON.stringify(parseLog.attachmentFilenames),
                hasHtml: parseLog.hasHtml,
                htmlLength: parseLog.htmlLength,
                parseAttempts: JSON.stringify(parseLog.parseAttempts),
                parseResults: JSON.stringify(parseLog.parseResults),
                errorReason: parseLog.errorReason,
                errorDetails: parseLog.errorDetails,
              },
            });
            
            console.log(`✅ 创建解析结果记录, ID: ${parseResult.id}, 状态: ${parseStatus}`);
            console.log(`✅ 保存解析日志`);
            
            resolve();
          } catch (error: any) {
            reject(error);
          }
        });
      });
    });
    
    f.once('error', (err: Error) => {
      reject(err);
    });
    
    f.once('end', () => {
      // resolve会在message处理完成后调用
    });
  });
}

/**
 * 保存净值数据到数据库(返回实际落库数量)
 */
async function saveNavDataWithResultId(
  rows: Record<string, string>[],
  source: 'html' | 'excel' | 'vertical'
): Promise<number> {
  console.log(`💾 开始保存净值数据, 来源: ${source}, 行数: ${rows.length}`);
  
  let savedCount = 0;
  let skippedCount = 0;
  
  for (const row of rows) {
    console.log('🔍 原始数据行:', JSON.stringify(row));
    
    const mapped = mapRowFields(row);
    console.log('🔍 映射后数据:', JSON.stringify(mapped));
    
    const { cleaned, issues } = cleanNavData(mapped);
    
    if (!cleaned) {
      console.warn('⚠️ 数据清洗失败,跳过:', issues);
      skippedCount++;
      continue;
    }
    
    console.log('✅ 清洗后数据:', JSON.stringify(cleaned));
    
    // 使用upsert避免重复
    try {
      const result = await prisma.navData.upsert({
        where: {
          productCode_navDate: {
            productCode: cleaned.productCode,
            navDate: new Date(cleaned.navDate),
          },
        },
        update: {
          unitNav: cleaned.unitNav,
          cumulativeNav: cleaned.cumulativeNav,
          source,
          confidence: source === 'excel' ? 'high' : 'medium',
        },
        create: {
          productCode: cleaned.productCode,
          productName: cleaned.productName,
          navDate: new Date(cleaned.navDate),
          unitNav: cleaned.unitNav,
          cumulativeNav: cleaned.cumulativeNav,
          source,
          confidence: source === 'excel' ? 'high' : 'medium',
        },
      });
      
      savedCount++;
      console.log(`✅ 保存成功: ${cleaned.productCode} - ${cleaned.productName}`);
    } catch (error: any) {
      console.error('❌ 保存失败:', error.message);
    }
  }
  
  console.log(`💾 保存完成: 成功 ${savedCount} 条, 跳过 ${skippedCount} 条`);
  return savedCount;
}

/**
 * 保存净值数据到数据库(旧版,已弃用)
 */
async function saveNavData(
  rows: Record<string, string>[],
  emailConfigId: number,
  emailUid: number,
  source: 'html' | 'excel' | 'vertical'
): Promise<number> {
  console.log(`💾 [旧版]开始保存净值数据, 来源: ${source}, 行数: ${rows.length}`);
  
  const parseResult = await prisma.emailParseResult.findFirst({
    where: {
      emailConfigId,
      emailUid: String(emailUid),
    },
    orderBy: { createdAt: 'desc' },
  });
  
  if (!parseResult) {
    console.error('❌ 未找到解析结果记录, emailUid:', emailUid);
    return 0;
  }
  
  console.log('✅ 找到解析结果记录, ID:', parseResult.id);
  
  return await saveNavDataWithResultId(rows, source);
}

/**
 * 🚨 验证数据行是否能通过清洗落库
 * 返回可以通过清洗的行数
 */
function validateRowsCanSave(rows: Record<string, string>[]): number {
  let canSaveCount = 0;
  
  for (const row of rows) {
    const mapped = mapRowFields(row);
    const { cleaned } = cleanNavData(mapped);
    
    if (cleaned) {
      canSaveCount++;
    }
  }
  
  return canSaveCount;
}
