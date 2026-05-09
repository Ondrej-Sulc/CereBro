ALTER TABLE "PlayerQuestEncounter" ADD COLUMN "prefightChampionId" INTEGER;

CREATE INDEX "PlayerQuestEncounter_prefightChampionId_idx" ON "PlayerQuestEncounter"("prefightChampionId");

ALTER TABLE "PlayerQuestEncounter" ADD CONSTRAINT "PlayerQuestEncounter_prefightChampionId_fkey" FOREIGN KEY ("prefightChampionId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
