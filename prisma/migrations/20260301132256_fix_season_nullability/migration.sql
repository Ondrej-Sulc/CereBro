/*
  Warnings:

  - Made the column `season` on table `WarNodeAllocation` required. This step will fail if there are existing NULL values in that column.

*/

-- Deduplicate rows that will conflict when season is set to 0
-- This handles cases where a record with season=0 already exists, or where multiple NULLs exist for the same node/modifier/tier/map
DELETE FROM "WarNodeAllocation" a
USING "WarNodeAllocation" b
WHERE a.id > b.id
  AND a."warNodeId" = b."warNodeId"
  AND a."nodeModifierId" = b."nodeModifierId"
  AND a."minTier" = b."minTier"
  AND a."maxTier" = b."maxTier"
  AND a."mapType" = b."mapType"
  AND COALESCE(a."season", 0) = COALESCE(b."season", 0);

-- Update existing NULL values to 0 before setting NOT NULL
UPDATE "WarNodeAllocation" SET "season" = 0 WHERE "season" IS NULL;

-- AlterTable
ALTER TABLE "WarNodeAllocation" ALTER COLUMN "season" SET NOT NULL;
