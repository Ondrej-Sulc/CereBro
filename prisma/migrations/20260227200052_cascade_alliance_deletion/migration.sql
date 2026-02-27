-- DropForeignKey
ALTER TABLE "War" DROP CONSTRAINT "War_allianceId_fkey";

-- AddForeignKey
ALTER TABLE "War" ADD CONSTRAINT "War_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
