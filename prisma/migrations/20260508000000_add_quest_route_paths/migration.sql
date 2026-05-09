-- Create route sections and paths for multi-path quest planning.
CREATE TABLE "QuestRouteSection" (
    "id" TEXT NOT NULL,
    "questPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestRouteSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestRoutePath" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestRoutePath_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerQuestRouteChoice" (
    "id" TEXT NOT NULL,
    "playerQuestPlanId" TEXT NOT NULL,
    "questRouteSectionId" TEXT NOT NULL,
    "questRoutePathId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerQuestRouteChoice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuestEncounter" ADD COLUMN "routePathId" TEXT;

CREATE UNIQUE INDEX "QuestRouteSection_questPlanId_order_key" ON "QuestRouteSection"("questPlanId", "order");
CREATE INDEX "QuestRouteSection_questPlanId_idx" ON "QuestRouteSection"("questPlanId");

CREATE UNIQUE INDEX "QuestRoutePath_sectionId_order_key" ON "QuestRoutePath"("sectionId", "order");
CREATE INDEX "QuestRoutePath_sectionId_idx" ON "QuestRoutePath"("sectionId");

CREATE UNIQUE INDEX "PlayerQuestRouteChoice_playerQuestPlanId_questRouteSectionId_key" ON "PlayerQuestRouteChoice"("playerQuestPlanId", "questRouteSectionId");
CREATE INDEX "PlayerQuestRouteChoice_playerQuestPlanId_idx" ON "PlayerQuestRouteChoice"("playerQuestPlanId");
CREATE INDEX "PlayerQuestRouteChoice_questRouteSectionId_idx" ON "PlayerQuestRouteChoice"("questRouteSectionId");
CREATE INDEX "PlayerQuestRouteChoice_questRoutePathId_idx" ON "PlayerQuestRouteChoice"("questRoutePathId");

CREATE INDEX "QuestEncounter_routePathId_idx" ON "QuestEncounter"("routePathId");

ALTER TABLE "QuestRouteSection" ADD CONSTRAINT "QuestRouteSection_questPlanId_fkey" FOREIGN KEY ("questPlanId") REFERENCES "QuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestRoutePath" ADD CONSTRAINT "QuestRoutePath_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "QuestRouteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestEncounter" ADD CONSTRAINT "QuestEncounter_routePathId_fkey" FOREIGN KEY ("routePathId") REFERENCES "QuestRoutePath"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlayerQuestRouteChoice" ADD CONSTRAINT "PlayerQuestRouteChoice_playerQuestPlanId_fkey" FOREIGN KEY ("playerQuestPlanId") REFERENCES "PlayerQuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerQuestRouteChoice" ADD CONSTRAINT "PlayerQuestRouteChoice_questRouteSectionId_fkey" FOREIGN KEY ("questRouteSectionId") REFERENCES "QuestRouteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerQuestRouteChoice" ADD CONSTRAINT "PlayerQuestRouteChoice_questRoutePathId_fkey" FOREIGN KEY ("questRoutePathId") REFERENCES "QuestRoutePath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
