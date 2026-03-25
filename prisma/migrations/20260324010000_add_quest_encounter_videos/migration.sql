-- CreateTable
CREATE TABLE "QuestEncounterVideo" (
    "id" TEXT NOT NULL,
    "questEncounterId" TEXT NOT NULL,
    "playerId" TEXT,
    "videoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestEncounterVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestEncounterVideo_questEncounterId_idx" ON "QuestEncounterVideo"("questEncounterId");

-- CreateIndex
CREATE INDEX "QuestEncounterVideo_playerId_idx" ON "QuestEncounterVideo"("playerId");

-- AddForeignKey
ALTER TABLE "QuestEncounterVideo" ADD CONSTRAINT "QuestEncounterVideo_questEncounterId_fkey" FOREIGN KEY ("questEncounterId") REFERENCES "QuestEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEncounterVideo" ADD CONSTRAINT "QuestEncounterVideo_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
