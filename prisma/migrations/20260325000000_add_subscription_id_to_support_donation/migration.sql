-- AlterTable
ALTER TABLE "SupportDonation" ADD COLUMN "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "SupportDonation_stripeSubscriptionId_idx" ON "SupportDonation"("stripeSubscriptionId");
