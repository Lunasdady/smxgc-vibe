// 邮件解析引擎统一导出

export { encrypt, decrypt } from './crypto';
export {
  createImapConnection,
  testImapConnection,
  fetchNewEmails,
  openInbox,
} from './imap-client';
export type { EmailMessage, ImapConfig } from './imap-client';

export { parseHtmlTables, findNavTable } from './html-parser';
export type { ParsedTable } from './html-parser';

export { parseExcelBuffer, findNavSheet } from './excel-parser';
export type { ParsedSheet } from './excel-parser';

export { parseVerticalTable, isVerticalTable } from './vertical-parser';
export type { ParsedVerticalData } from './vertical-parser';

export { FIELD_ALIASES, BROKER_TEMPLATES, normalizeFieldName, mapRowFields, identifyBroker } from './field-mapper';

export { cleanNavData, detectAnomaly, normalizeDate } from './data-cleaner';
export type { CleanedNavData, DataQualityIssue } from './data-cleaner';

export { isNavEmail, getParseStrategy, initDefaultRules } from './rules';

export { parseEmailConfig } from './engine';
export type { ParseProgress, ParseResult } from './engine';

export { initEmailScheduler } from './scheduler';
