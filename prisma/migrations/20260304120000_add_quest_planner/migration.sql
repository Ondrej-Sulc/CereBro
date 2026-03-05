-- CreateEnum
CREATE TYPE "QuestPlanStatus" AS ENUM ('DRAFT', 'VISIBLE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "QuestCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "QuestPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "creatorId" TEXT,
    "categoryId" TEXT,
    "minStarLevel" INTEGER CHECK("minStarLevel" > 0),
    "maxStarLevel" INTEGER CHECK("maxStarLevel" > 0),
    "teamLimit" INTEGER NOT NULL DEFAULT 5 CHECK("teamLimit" > 0),
    "requiredClasses" "ChampionClass"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestEncounter" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "tips" TEXT,
    "minStarLevel" INTEGER CHECK("minStarLevel" > 0),
    "maxStarLevel" INTEGER CHECK("maxStarLevel" > 0),
    "requiredClasses" "ChampionClass"[],
    "questPlanId" TEXT NOT NULL,
    "defenderId" INTEGER,
    "recommendedTags" TEXT[],

    CONSTRAINT "QuestEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestEncounterNode" (
    "id" TEXT NOT NULL,
    "questEncounterId" TEXT NOT NULL,
    "nodeModifierId" TEXT NOT NULL,

    CONSTRAINT "QuestEncounterNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerQuestPlan" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "questPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerQuestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerQuestEncounter" (
    "id" TEXT NOT NULL,
    "playerQuestPlanId" TEXT NOT NULL,
    "questEncounterId" TEXT NOT NULL,
    "questPlanId" TEXT NOT NULL,
    "selectedChampionId" INTEGER,

    CONSTRAINT "PlayerQuestEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EncounterRecommendedChampions" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EncounterRecommendedChampions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_QuestRequiredTags" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_QuestRequiredTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EncounterRequiredTags" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_EncounterRequiredTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestCategory_name_key" ON "QuestCategory"("name");

-- CreateIndex
CREATE INDEX "QuestCategory_parentId_idx" ON "QuestCategory"("parentId");

-- CreateIndex
CREATE INDEX "QuestPlan_status_idx" ON "QuestPlan"("status");

-- CreateIndex
CREATE INDEX "QuestPlan_creatorId_idx" ON "QuestPlan"("creatorId");

-- CreateIndex
CREATE INDEX "QuestEncounter_questPlanId_idx" ON "QuestEncounter"("questPlanId");

-- CreateIndex
CREATE INDEX "QuestEncounter_defenderId_idx" ON "QuestEncounter"("defenderId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestEncounter_questPlanId_sequence_key" ON "QuestEncounter"("questPlanId", "sequence");

-- CreateIndex
CREATE INDEX "QuestEncounterNode_questEncounterId_idx" ON "QuestEncounterNode"("questEncounterId");

-- CreateIndex
CREATE INDEX "QuestEncounterNode_nodeModifierId_idx" ON "QuestEncounterNode"("nodeModifierId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestEncounterNode_questEncounterId_nodeModifierId_key" ON "QuestEncounterNode"("questEncounterId", "nodeModifierId");

-- CreateIndex
CREATE INDEX "PlayerQuestPlan_playerId_idx" ON "PlayerQuestPlan"("playerId");

-- CreateIndex
CREATE INDEX "PlayerQuestPlan_questPlanId_idx" ON "PlayerQuestPlan"("questPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerQuestPlan_playerId_questPlanId_key" ON "PlayerQuestPlan"("playerId", "questPlanId");

-- CreateIndex
CREATE INDEX "PlayerQuestEncounter_playerQuestPlanId_idx" ON "PlayerQuestEncounter"("playerQuestPlanId");

-- CreateIndex
CREATE INDEX "PlayerQuestEncounter_questEncounterId_idx" ON "PlayerQuestEncounter"("questEncounterId");

-- CreateIndex
CREATE INDEX "PlayerQuestEncounter_selectedChampionId_idx" ON "PlayerQuestEncounter"("selectedChampionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerQuestEncounter_playerQuestPlanId_questEncounterId_key" ON "PlayerQuestEncounter"("playerQuestPlanId", "questEncounterId");

-- CreateIndex
CREATE INDEX "_EncounterRecommendedChampions_B_index" ON "_EncounterRecommendedChampions"("B");

-- CreateIndex
CREATE INDEX "_QuestRequiredTags_B_index" ON "_QuestRequiredTags"("B");

-- CreateIndex
CREATE INDEX "_EncounterRequiredTags_B_index" ON "_EncounterRequiredTags"("B");

-- AddForeignKey
ALTER TABLE "QuestCategory" ADD CONSTRAINT "QuestCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "QuestCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "QuestPlan" ADD CONSTRAINT "QuestPlan_starLevel_check" CHECK ("minStarLevel" IS NULL OR "maxStarLevel" IS NULL OR "minStarLevel" <= "maxStarLevel");

-- AddCheckConstraint
ALTER TABLE "QuestEncounter" ADD CONSTRAINT "QuestEncounter_starLevel_check" CHECK ("minStarLevel" IS NULL OR "maxStarLevel" IS NULL OR "minStarLevel" <= "maxStarLevel");

-- AddForeignKey
ALTER TABLE "QuestPlan" ADD CONSTRAINT "QuestPlan_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestPlan" ADD CONSTRAINT "QuestPlan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "QuestCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEncounter" ADD CONSTRAINT "QuestEncounter_questPlanId_fkey" FOREIGN KEY ("questPlanId") REFERENCES "QuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEncounter" ADD CONSTRAINT "QuestEncounter_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEncounterNode" ADD CONSTRAINT "QuestEncounterNode_questEncounterId_fkey" FOREIGN KEY ("questEncounterId") REFERENCES "QuestEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEncounterNode" ADD CONSTRAINT "QuestEncounterNode_nodeModifierId_fkey" FOREIGN KEY ("nodeModifierId") REFERENCES "NodeModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerQuestPlan" ADD CONSTRAINT "PlayerQuestPlan_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerQuestPlan" ADD CONSTRAINT "PlayerQuestPlan_questPlanId_fkey" FOREIGN KEY ("questPlanId") REFERENCES "QuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerQuestEncounter" ADD CONSTRAINT "PlayerQuestEncounter_playerQuestPlanId_questPlanId_fkey" FOREIGN KEY ("playerQuestPlanId", "questPlanId") REFERENCES "PlayerQuestPlan"("id", "questPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerQuestEncounter" ADD CONSTRAINT "PlayerQuestEncounter_questEncounterId_questPlanId_fkey" FOREIGN KEY ("questEncounterId", "questPlanId") REFERENCES "QuestEncounter"("id", "questPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerQuestEncounter" ADD CONSTRAINT "PlayerQuestEncounter_selectedChampionId_fkey" FOREIGN KEY ("selectedChampionId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EncounterRecommendedChampions" ADD CONSTRAINT "_EncounterRecommendedChampions_A_fkey" FOREIGN KEY ("A") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EncounterRecommendedChampions" ADD CONSTRAINT "_EncounterRecommendedChampions_B_fkey" FOREIGN KEY ("B") REFERENCES "QuestEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestRequiredTags" ADD CONSTRAINT "_QuestRequiredTags_A_fkey" FOREIGN KEY ("A") REFERENCES "QuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestRequiredTags" ADD CONSTRAINT "_QuestRequiredTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EncounterRequiredTags" ADD CONSTRAINT "_EncounterRequiredTags_A_fkey" FOREIGN KEY ("A") REFERENCES "QuestEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EncounterRequiredTags" ADD CONSTRAINT "_EncounterRequiredTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
