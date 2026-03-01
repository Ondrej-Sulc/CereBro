/*
  Warnings:

  - Made the column `season` on table `WarNodeAllocation` required. This step will fail if there are existing NULL values in that column.

*/
-- Update existing NULL values to 0 before setting NOT NULL
UPDATE "WarNodeAllocation" SET "season" = 0 WHERE "season" IS NULL;

-- AlterTable
ALTER TABLE "WarNodeAllocation" ALTER COLUMN "season" SET NOT NULL;
