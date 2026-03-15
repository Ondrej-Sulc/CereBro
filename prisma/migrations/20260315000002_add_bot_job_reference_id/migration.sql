-- AlterTable
ALTER TABLE "BotJob" ADD COLUMN "referenceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BotJob_type_referenceId_key" ON "BotJob"("type", "referenceId");