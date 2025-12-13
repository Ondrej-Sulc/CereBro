/*
  Warnings:

  - A unique constraint covering the columns `[planId,battlegroup,nodeId]` on the table `WarDefensePlacement` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WarDefensePlacement_planId_nodeId_key";

-- AlterTable
ALTER TABLE "WarDefensePlacement" ADD COLUMN     "battlegroup" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "WarDefensePlacement_planId_battlegroup_nodeId_key" ON "WarDefensePlacement"("planId", "battlegroup", "nodeId");
