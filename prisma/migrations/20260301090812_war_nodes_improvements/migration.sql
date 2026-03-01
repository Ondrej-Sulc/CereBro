/*
  Warnings:

  - A unique constraint covering the columns `[warNodeId,nodeModifierId,minTier,maxTier,season,mapType]` on the table `WarNodeAllocation` will be added. If there are existing duplicate values, this will fail.
  - Made the column `minTier` on table `WarNodeAllocation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `maxTier` on table `WarNodeAllocation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "WarNodeAllocation" ALTER COLUMN "minTier" SET NOT NULL,
ALTER COLUMN "minTier" SET DEFAULT 0,
ALTER COLUMN "maxTier" SET NOT NULL,
ALTER COLUMN "maxTier" SET DEFAULT 0,
ALTER COLUMN "season" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "WarNodeAllocation_warNodeId_nodeModifierId_minTier_maxTier__key" ON "WarNodeAllocation"("warNodeId", "nodeModifierId", "minTier", "maxTier", "season", "mapType");
