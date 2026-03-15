-- AlterTable
ALTER TABLE "SupportDonation" ADD COLUMN     "botUserId" TEXT,
ADD COLUMN     "discordId" TEXT;

-- CreateIndex
CREATE INDEX "SupportDonation_botUserId_createdAt_idx" ON "SupportDonation"("botUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportDonation_discordId_createdAt_idx" ON "SupportDonation"("discordId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportDonation" ADD CONSTRAINT "SupportDonation_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "BotUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
