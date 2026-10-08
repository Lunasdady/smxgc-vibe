/*
  Warnings:

  - Added the required column `category` to the `StrategyMapping` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StrategyMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "primaryStrategy" TEXT NOT NULL,
    "secondaryStrategy" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StrategyMapping" ("createdAt", "id", "primaryStrategy", "productCode", "productName", "secondaryStrategy", "updatedAt") SELECT "createdAt", "id", "primaryStrategy", "productCode", "productName", "secondaryStrategy", "updatedAt" FROM "StrategyMapping";
DROP TABLE "StrategyMapping";
ALTER TABLE "new_StrategyMapping" RENAME TO "StrategyMapping";
CREATE INDEX "StrategyMapping_productCode_idx" ON "StrategyMapping"("productCode");
CREATE INDEX "StrategyMapping_primaryStrategy_idx" ON "StrategyMapping"("primaryStrategy");
CREATE INDEX "StrategyMapping_secondaryStrategy_idx" ON "StrategyMapping"("secondaryStrategy");
CREATE INDEX "StrategyMapping_category_idx" ON "StrategyMapping"("category");
CREATE UNIQUE INDEX "StrategyMapping_productCode_key" ON "StrategyMapping"("productCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
