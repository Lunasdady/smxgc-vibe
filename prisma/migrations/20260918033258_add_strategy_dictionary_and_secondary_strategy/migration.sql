/*
  Warnings:

  - You are about to drop the column `strategyType` on the `StrategyMapping` table. All the data in the column will be lost.
  - Added the required column `primaryStrategy` to the `StrategyMapping` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secondaryStrategy` to the `StrategyMapping` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "StrategyDictionary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" INTEGER NOT NULL,
    "parentStrategy" TEXT,
    "strategyName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StrategyMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "primaryStrategy" TEXT NOT NULL,
    "secondaryStrategy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StrategyMapping" ("createdAt", "id", "productCode", "productName", "updatedAt") SELECT "createdAt", "id", "productCode", "productName", "updatedAt" FROM "StrategyMapping";
DROP TABLE "StrategyMapping";
ALTER TABLE "new_StrategyMapping" RENAME TO "StrategyMapping";
CREATE INDEX "StrategyMapping_productCode_idx" ON "StrategyMapping"("productCode");
CREATE INDEX "StrategyMapping_primaryStrategy_idx" ON "StrategyMapping"("primaryStrategy");
CREATE INDEX "StrategyMapping_secondaryStrategy_idx" ON "StrategyMapping"("secondaryStrategy");
CREATE UNIQUE INDEX "StrategyMapping_productCode_key" ON "StrategyMapping"("productCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StrategyDictionary_level_idx" ON "StrategyDictionary"("level");

-- CreateIndex
CREATE INDEX "StrategyDictionary_parentStrategy_idx" ON "StrategyDictionary"("parentStrategy");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyDictionary_level_parentStrategy_strategyName_key" ON "StrategyDictionary"("level", "parentStrategy", "strategyName");
