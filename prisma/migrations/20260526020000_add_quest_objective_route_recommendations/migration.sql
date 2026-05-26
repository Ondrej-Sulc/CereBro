CREATE TABLE "QuestObjectiveRouteRecommendation" (
    "id" TEXT NOT NULL,
    "questObjectiveId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestObjectiveRouteRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestObjectiveRouteRecommendationChoice" (
    "id" TEXT NOT NULL,
    "routeRecommendationId" TEXT NOT NULL,
    "questRouteSectionId" TEXT NOT NULL,
    "questRoutePathId" TEXT NOT NULL,

    CONSTRAINT "QuestObjectiveRouteRecommendationChoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuestObjectiveRouteRecommendation_questObjectiveId_slug_key" ON "QuestObjectiveRouteRecommendation"("questObjectiveId", "slug");
CREATE UNIQUE INDEX "QuestObjectiveRouteRecommendation_questObjectiveId_order_key" ON "QuestObjectiveRouteRecommendation"("questObjectiveId", "order");
CREATE INDEX "QuestObjectiveRouteRecommendation_questObjectiveId_idx" ON "QuestObjectiveRouteRecommendation"("questObjectiveId");

CREATE UNIQUE INDEX "QuestObjectiveRouteRecommendationChoice_routeRecommendationId_questRouteSectionId_key" ON "QuestObjectiveRouteRecommendationChoice"("routeRecommendationId", "questRouteSectionId");
CREATE INDEX "QuestObjectiveRouteRecommendationChoice_questRoutePathId_idx" ON "QuestObjectiveRouteRecommendationChoice"("questRoutePathId");

ALTER TABLE "QuestObjectiveRouteRecommendation" ADD CONSTRAINT "QuestObjectiveRouteRecommendation_questObjectiveId_fkey" FOREIGN KEY ("questObjectiveId") REFERENCES "QuestObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteRecommendationChoice" ADD CONSTRAINT "QuestObjectiveRouteRecommendationChoice_routeRecommendationId_fkey" FOREIGN KEY ("routeRecommendationId") REFERENCES "QuestObjectiveRouteRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteRecommendationChoice" ADD CONSTRAINT "QuestObjectiveRouteRecommendationChoice_questRouteSectionId_fkey" FOREIGN KEY ("questRouteSectionId") REFERENCES "QuestRouteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteRecommendationChoice" ADD CONSTRAINT "QuestObjectiveRouteRecommendationChoice_questRoutePathId_fkey" FOREIGN KEY ("questRoutePathId") REFERENCES "QuestRoutePath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestObjectiveRouteRecommendationChoice" ADD CONSTRAINT "QuestObjectiveRouteRecommendationChoice_path_belongs_to_section_check" FOREIGN KEY ("questRoutePathId", "questRouteSectionId") REFERENCES "QuestRoutePath"("id", "sectionId") ON DELETE CASCADE ON UPDATE CASCADE;
