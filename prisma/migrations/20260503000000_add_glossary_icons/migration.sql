-- AlterTable
ALTER TABLE "GameGlossaryTerm" ADD COLUMN "iconUrl" TEXT;

-- AlterTable
ALTER TABLE "Ability" ADD COLUMN "iconUrl" TEXT,
ADD COLUMN "gameGlossaryTermId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ability_gameGlossaryTermId_key" ON "Ability"("gameGlossaryTermId");

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_gameGlossaryTermId_fkey" FOREIGN KEY ("gameGlossaryTermId") REFERENCES "GameGlossaryTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
