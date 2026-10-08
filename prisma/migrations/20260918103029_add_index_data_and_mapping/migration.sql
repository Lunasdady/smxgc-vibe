-- CreateTable
CREATE TABLE "IndexData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "indexCode" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "closePrice" REAL NOT NULL,
    "dailyReturn" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IndexMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "secondaryStrategy" TEXT NOT NULL,
    "indexCode" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "IndexData_indexCode_idx" ON "IndexData"("indexCode");

-- CreateIndex
CREATE INDEX "IndexData_tradeDate_idx" ON "IndexData"("tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "IndexData_indexCode_tradeDate_key" ON "IndexData"("indexCode", "tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "IndexMapping_secondaryStrategy_key" ON "IndexMapping"("secondaryStrategy");

-- CreateIndex
CREATE INDEX "IndexMapping_secondaryStrategy_idx" ON "IndexMapping"("secondaryStrategy");

-- CreateIndex
CREATE INDEX "IndexMapping_indexCode_idx" ON "IndexMapping"("indexCode");
