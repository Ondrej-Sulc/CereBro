CREATE TYPE "QuestObjectiveTagMode" AS ENUM ('ALL', 'ANY');

ALTER TABLE "PlayerQuestPlan" ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'base';
ALTER TABLE "PlayerQuestPlan" ADD COLUMN "questObjectiveId" TEXT;

CREATE TABLE "QuestObjective" (
    "id" TEXT NOT NULL,
    "questPlanId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "teamLimitOverride" INTEGER,
    "minStarLevel" INTEGER,
    "maxStarLevel" INTEGER,
    "requiredClasses" "ChampionClass"[],
    "requiredTagMode" "QuestObjectiveTagMode" NOT NULL DEFAULT 'ALL',
    "endpointEncounterId" TEXT,
    "defaultShowContinuation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestObjective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestObjectiveRouteChoice" (
    "id" TEXT NOT NULL,
    "questObjectiveId" TEXT NOT NULL,
    "questRouteSectionId" TEXT NOT NULL,
    "questRoutePathId" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestObjectiveRouteChoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_QuestObjectiveRequiredTags" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_QuestObjectiveRequiredTags_AB_pkey" PRIMARY KEY ("A","B")
);

DROP INDEX "PlayerQuestPlan_playerId_questPlanId_key";
CREATE UNIQUE INDEX "PlayerQuestPlan_playerId_questPlanId_scopeKey_key" ON "PlayerQuestPlan"("playerId", "questPlanId", "scopeKey");
CREATE INDEX "PlayerQuestPlan_questObjectiveId_idx" ON "PlayerQuestPlan"("questObjectiveId");

CREATE UNIQUE INDEX "QuestObjective_questPlanId_slug_key" ON "QuestObjective"("questPlanId", "slug");
CREATE UNIQUE INDEX "QuestObjective_questPlanId_order_key" ON "QuestObjective"("questPlanId", "order");
CREATE INDEX "QuestObjective_questPlanId_idx" ON "QuestObjective"("questPlanId");
CREATE INDEX "QuestObjective_endpointEncounterId_idx" ON "QuestObjective"("endpointEncounterId");

CREATE UNIQUE INDEX "QuestObjectiveRouteChoice_questObjectiveId_questRouteSectionId_key" ON "QuestObjectiveRouteChoice"("questObjectiveId", "questRouteSectionId");
CREATE INDEX "QuestObjectiveRouteChoice_questRouteSectionId_idx" ON "QuestObjectiveRouteChoice"("questRouteSectionId");
CREATE INDEX "QuestObjectiveRouteChoice_questRoutePathId_idx" ON "QuestObjectiveRouteChoice"("questRoutePathId");
CREATE INDEX "_QuestObjectiveRequiredTags_B_index" ON "_QuestObjectiveRequiredTags"("B");

ALTER TABLE "QuestObjective" ADD CONSTRAINT "QuestObjective_questPlanId_fkey" FOREIGN KEY ("questPlanId") REFERENCES "QuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjective" ADD CONSTRAINT "QuestObjective_endpointEncounterId_fkey" FOREIGN KEY ("endpointEncounterId") REFERENCES "QuestEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteChoice" ADD CONSTRAINT "QuestObjectiveRouteChoice_questObjectiveId_fkey" FOREIGN KEY ("questObjectiveId") REFERENCES "QuestObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteChoice" ADD CONSTRAINT "QuestObjectiveRouteChoice_questRouteSectionId_fkey" FOREIGN KEY ("questRouteSectionId") REFERENCES "QuestRouteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteChoice" ADD CONSTRAINT "QuestObjectiveRouteChoice_questRoutePathId_fkey" FOREIGN KEY ("questRoutePathId") REFERENCES "QuestRoutePath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteChoice" ADD CONSTRAINT "QuestObjectiveRouteChoice_path_belongs_to_section_check" FOREIGN KEY ("questRoutePathId", "questRouteSectionId") REFERENCES "QuestRoutePath"("id", "sectionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerQuestPlan" ADD CONSTRAINT "PlayerQuestPlan_questObjectiveId_fkey" FOREIGN KEY ("questObjectiveId") REFERENCES "QuestObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_QuestObjectiveRequiredTags" ADD CONSTRAINT "_QuestObjectiveRequiredTags_A_fkey" FOREIGN KEY ("A") REFERENCES "QuestObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_QuestObjectiveRequiredTags" ADD CONSTRAINT "_QuestObjectiveRequiredTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
