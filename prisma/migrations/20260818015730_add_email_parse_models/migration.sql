-- CreateTable
CREATE TABLE "FundProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dataDate" DATETIME NOT NULL,
    "strategyType" TEXT NOT NULL,
    "fundManager" TEXT NOT NULL,
    "managerScale" TEXT NOT NULL,
    "isLargeScale" BOOLEAN NOT NULL,
    "productName" TEXT NOT NULL,
    "strategyCategory" TEXT,
    "weeklyReturn" REAL,
    "monthlyReturn" REAL,
    "ytdReturn" REAL,
    "annualizedReturnSinceInception" REAL,
    "ytdMaxDrawdown" REAL,
    "inceptionMaxDrawdown" REAL,
    "annualizedVolatility" REAL,
    "sharpeRatio" REAL,
    "excessReturn1w" REAL,
    "excessReturn3m" REAL,
    "excessReturnYtd" REAL,
    "excessAnnualizedReturn" REAL,
    "excessYtdMaxDrawdown" REAL,
    "excessInceptionMaxDrawdown" REAL,
    "excessAnnualizedVolatility" REAL,
    "excessSharpeRatio" REAL,
    "karmaRatio" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "realName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "referrer" TEXT,
    "password" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "page" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmailConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "passwordEncrypted" TEXT NOT NULL,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastParsedAt" DATETIME,
    "lastParsedUid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailParseResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emailUid" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT,
    "sentDate" DATETIME,
    "receivedAt" DATETIME NOT NULL,
    "emailConfigId" INTEGER NOT NULL,
    "htmlParsed" BOOLEAN NOT NULL DEFAULT false,
    "excelParsed" BOOLEAN NOT NULL DEFAULT false,
    "parseStatus" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "errorReason" TEXT,
    "rawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailParseResult_emailConfigId_fkey" FOREIGN KEY ("emailConfigId") REFERENCES "EmailConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NavData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "navDate" DATETIME NOT NULL,
    "unitNav" REAL,
    "cumulativeNav" REAL,
    "source" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "emailParseResultId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NavData_emailParseResultId_fkey" FOREIGN KEY ("emailParseResultId") REFERENCES "EmailParseResult" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParseLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emailUid" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "emailConfigId" INTEGER NOT NULL,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentTypes" TEXT,
    "attachmentFilenames" TEXT,
    "hasHtml" BOOLEAN NOT NULL DEFAULT false,
    "htmlLength" INTEGER NOT NULL DEFAULT 0,
    "parseAttempts" TEXT NOT NULL,
    "parseResults" TEXT,
    "errorReason" TEXT,
    "errorDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DiagnosticReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "report" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 0,
    "suggestionsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OptimizationRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beforeSuccessRate" REAL NOT NULL DEFAULT 0,
    "beforeFailedCount" INTEGER NOT NULL DEFAULT 0,
    "optimizations" TEXT NOT NULL,
    "newAliases" TEXT,
    "newStrategies" TEXT,
    "afterSuccessRate" REAL,
    "afterFailedCount" INTEGER,
    "improvedCount" INTEGER,
    "validationReport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ParseRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ruleType" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleValue" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ParseTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "current" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL DEFAULT '等待解析...',
    "fullParse" BOOLEAN NOT NULL DEFAULT false,
    "testLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "FundProduct_dataDate_idx" ON "FundProduct"("dataDate");

-- CreateIndex
CREATE INDEX "FundProduct_dataDate_strategyType_idx" ON "FundProduct"("dataDate", "strategyType");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_page_createdAt_idx" ON "AccessLog"("page", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_userId_createdAt_idx" ON "AccessLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailConfig_email_key" ON "EmailConfig"("email");

-- CreateIndex
CREATE INDEX "EmailConfig_enabled_idx" ON "EmailConfig"("enabled");

-- CreateIndex
CREATE INDEX "EmailParseResult_emailConfigId_idx" ON "EmailParseResult"("emailConfigId");

-- CreateIndex
CREATE INDEX "EmailParseResult_parseStatus_idx" ON "EmailParseResult"("parseStatus");

-- CreateIndex
CREATE INDEX "EmailParseResult_receivedAt_idx" ON "EmailParseResult"("receivedAt");

-- CreateIndex
CREATE INDEX "NavData_productCode_idx" ON "NavData"("productCode");

-- CreateIndex
CREATE INDEX "NavData_navDate_idx" ON "NavData"("navDate");

-- CreateIndex
CREATE INDEX "NavData_productName_idx" ON "NavData"("productName");

-- CreateIndex
CREATE INDEX "NavData_emailParseResultId_idx" ON "NavData"("emailParseResultId");

-- CreateIndex
CREATE UNIQUE INDEX "NavData_productCode_navDate_key" ON "NavData"("productCode", "navDate");

-- CreateIndex
CREATE INDEX "ParseLog_emailUid_idx" ON "ParseLog"("emailUid");

-- CreateIndex
CREATE INDEX "ParseLog_emailConfigId_idx" ON "ParseLog"("emailConfigId");

-- CreateIndex
CREATE INDEX "ParseLog_createdAt_idx" ON "ParseLog"("createdAt");

-- CreateIndex
CREATE INDEX "DiagnosticReport_createdAt_idx" ON "DiagnosticReport"("createdAt");

-- CreateIndex
CREATE INDEX "OptimizationRecord_createdAt_idx" ON "OptimizationRecord"("createdAt");

-- CreateIndex
CREATE INDEX "OptimizationRecord_timestamp_idx" ON "OptimizationRecord"("timestamp");

-- CreateIndex
CREATE INDEX "ParseRule_ruleType_idx" ON "ParseRule"("ruleType");

-- CreateIndex
CREATE INDEX "ParseRule_enabled_idx" ON "ParseRule"("enabled");

-- CreateIndex
CREATE INDEX "ParseTask_status_idx" ON "ParseTask"("status");

-- CreateIndex
CREATE INDEX "ParseTask_configId_idx" ON "ParseTask"("configId");

-- CreateIndex
CREATE INDEX "ParseTask_createdAt_idx" ON "ParseTask"("createdAt");
