ALTER TABLE "QuestRouteSection" ADD COLUMN "parentPathId" TEXT;

CREATE INDEX "QuestRouteSection_parentPathId_idx" ON "QuestRouteSection"("parentPathId");

ALTER TABLE "QuestRouteSection" ADD CONSTRAINT "QuestRouteSection_parentPathId_fkey" FOREIGN KEY ("parentPathId") REFERENCES "QuestRoutePath"("id") ON DELETE SET NULL ON UPDATE CASCADE;
