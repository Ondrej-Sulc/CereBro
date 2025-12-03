/*
  Warnings:

  - You are about to drop the column `attackTag` on the `WarTactic` table. All the data in the column will be lost.
  - You are about to drop the column `defenseTag` on the `WarTactic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WarTactic" DROP COLUMN "attackTag",
DROP COLUMN "defenseTag",
ADD COLUMN     "attackTagId" INTEGER,
ADD COLUMN     "defenseTagId" INTEGER;

-- AddForeignKey
ALTER TABLE "WarTactic" ADD CONSTRAINT "WarTactic_attackTagId_fkey" FOREIGN KEY ("attackTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarTactic" ADD CONSTRAINT "WarTactic_defenseTagId_fkey" FOREIGN KEY ("defenseTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
