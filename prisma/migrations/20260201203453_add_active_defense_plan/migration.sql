/*
  Warnings:

  - A unique constraint covering the columns `[activeDefensePlanId]` on the table `Alliance` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN     "activeDefensePlanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_activeDefensePlanId_key" ON "Alliance"("activeDefensePlanId");

-- AddForeignKey
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_activeDefensePlanId_fkey" FOREIGN KEY ("activeDefensePlanId") REFERENCES "WarDefensePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
