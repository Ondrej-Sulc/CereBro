-- CreateTable
CREATE TABLE "QuestObjectiveEncounterRecommendationSet" (
    "id" TEXT NOT NULL,
    "questObjectiveId" TEXT NOT NULL,
    "questEncounterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestObjectiveEncounterRecommendationSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestObjectiveEncounterRecommendedChampion" (
    "id" TEXT NOT NULL,
    "recommendationSetId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestObjectiveEncounterRecommendedChampion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestObjectiveEncounterRecommendationSet_questObjectiveId_questEncounterId_key" ON "QuestObjectiveEncounterRecommendationSet"("questObjectiveId", "questEncounterId");

-- CreateIndex
CREATE INDEX "QuestObjectiveEncounterRecommendationSet_questEncounterId_idx" ON "QuestObjectiveEncounterRecommendationSet"("questEncounterId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestObjectiveEncounterRecommendedChampion_recommendationSetId_championId_key" ON "QuestObjectiveEncounterRecommendedChampion"("recommendationSetId", "championId");

-- CreateIndex
CREATE INDEX "QuestObjectiveEncounterRecommendedChampion_championId_idx" ON "QuestObjectiveEncounterRecommendedChampion"("championId");

-- AddForeignKey
ALTER TABLE "QuestObjectiveEncounterRecommendationSet" ADD CONSTRAINT "QuestObjectiveEncounterRecommendationSet_questObjectiveId_fkey" FOREIGN KEY ("questObjectiveId") REFERENCES "QuestObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestObjectiveEncounterRecommendationSet" ADD CONSTRAINT "QuestObjectiveEncounterRecommendationSet_questEncounterId_fkey" FOREIGN KEY ("questEncounterId") REFERENCES "QuestEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestObjectiveEncounterRecommendedChampion" ADD CONSTRAINT "QuestObjectiveEncounterRecommendedChampion_recommendationSetId_fkey" FOREIGN KEY ("recommendationSetId") REFERENCES "QuestObjectiveEncounterRecommendationSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestObjectiveEncounterRecommendedChampion" ADD CONSTRAINT "QuestObjectiveEncounterRecommendedChampion_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
