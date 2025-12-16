-- AlterTable
ALTER TABLE "WarDefensePlan" ADD COLUMN     "tier" INTEGER;

-- CreateIndex
CREATE INDEX "WarDefensePlacement_nodeId_idx" ON "WarDefensePlacement"("nodeId");
