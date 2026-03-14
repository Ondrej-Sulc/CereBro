-- Support donation records retain financial metadata for audit purposes.
-- PII lifecycle is handled by the DonationRetentionWorker operational job:
-- it anonymizes supporterName/supporterEmail and sets anonymizedAt/consentRevoked
-- instead of deleting rows, while deletedAt can be used to mark rows for purge.

-- CreateTable
CREATE TABLE "SupportDonation" (
    "id" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "supporterName" TEXT,
    "supporterEmail" TEXT,
    "retentionState" TEXT NOT NULL DEFAULT 'ACTIVE',
    "anonymizedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "consentRevoked" BOOLEAN NOT NULL DEFAULT false,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportDonation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportDonation_stripeCheckoutSessionId_key" ON "SupportDonation"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "SupportDonation_status_createdAt_idx" ON "SupportDonation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportDonation_playerId_createdAt_idx" ON "SupportDonation"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportDonation_retentionState_anonymizedAt_deletedAt_idx" ON "SupportDonation"("retentionState", "anonymizedAt", "deletedAt");

-- AddForeignKey
ALTER TABLE "SupportDonation" ADD CONSTRAINT "SupportDonation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
