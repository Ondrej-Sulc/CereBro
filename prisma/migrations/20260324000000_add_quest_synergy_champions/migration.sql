-- CreateTable
CREATE TABLE "PlayerQuestSynergyChampion" (
    "id" TEXT NOT NULL,
    "playerQuestPlanId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,

    CONSTRAINT "PlayerQuestSynergyChampion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerQuestSynergyChampion_playerQuestPlanId_idx" ON "PlayerQuestSynergyChampion"("playerQuestPlanId");

-- CreateIndex
CREATE INDEX "PlayerQuestSynergyChampion_championId_idx" ON "PlayerQuestSynergyChampion"("championId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerQuestSynergyChampion_playerQuestPlanId_championId_key" ON "PlayerQuestSynergyChampion"("playerQuestPlanId", "championId");

-- AddForeignKey
ALTER TABLE "PlayerQuestSynergyChampion" ADD CONSTRAINT "PlayerQuestSynergyChampion_playerQuestPlanId_fkey" FOREIGN KEY ("playerQuestPlanId") REFERENCES "PlayerQuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerQuestSynergyChampion" ADD CONSTRAINT "PlayerQuestSynergyChampion_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
