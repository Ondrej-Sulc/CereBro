-- AlterTable
ALTER TABLE "WarDefensePlan" ADD COLUMN     "highlightTagId" INTEGER;

-- AddForeignKey
ALTER TABLE "WarDefensePlan" ADD CONSTRAINT "WarDefensePlan_highlightTagId_fkey" FOREIGN KEY ("highlightTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
