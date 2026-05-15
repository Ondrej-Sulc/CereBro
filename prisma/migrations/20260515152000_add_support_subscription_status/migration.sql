-- Track the current Stripe subscription status separately from payment status.
-- Donation payment rows remain succeeded for all-time totals, while monthly
-- funding can exclude canceled or otherwise inactive recurring commitments.
ALTER TABLE "SupportDonation" ADD COLUMN "stripeSubscriptionStatus" TEXT;

UPDATE "SupportDonation"
SET "stripeSubscriptionStatus" = 'active'
WHERE "stripeSubscriptionId" IS NOT NULL
  AND "status" = 'succeeded';

CREATE INDEX "SupportDonation_stripeSubscriptionStatus_idx" ON "SupportDonation"("stripeSubscriptionStatus");
