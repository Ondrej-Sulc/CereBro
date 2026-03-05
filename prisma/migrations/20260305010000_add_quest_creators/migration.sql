-- CreateTable
CREATE TABLE "_QuestPlanCreators" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_QuestPlanCreators_AB_unique" ON "_QuestPlanCreators"("A", "B");

-- CreateIndex
CREATE INDEX "_QuestPlanCreators_B_index" ON "_QuestPlanCreators"("B");

-- AddForeignKey
ALTER TABLE "_QuestPlanCreators" ADD CONSTRAINT "_QuestPlanCreators_A_fkey" FOREIGN KEY ("A") REFERENCES "BotUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestPlanCreators" ADD CONSTRAINT "_QuestPlanCreators_B_fkey" FOREIGN KEY ("B") REFERENCES "QuestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
