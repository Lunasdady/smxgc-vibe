-- CreateTable
CREATE TABLE "StrategyMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "strategyType" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StrategyMapping_productCode_idx" ON "StrategyMapping"("productCode");

-- CreateIndex
CREATE INDEX "StrategyMapping_strategyType_idx" ON "StrategyMapping"("strategyType");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyMapping_productCode_key" ON "StrategyMapping"("productCode");
