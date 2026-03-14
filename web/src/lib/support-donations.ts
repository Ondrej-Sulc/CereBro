import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { requireBotAdmin } from "@/lib/auth-helpers";

export const DONATION_RETENTION_WORKER = "DonationRetentionWorker";
export const DONATION_RETENTION_POLICY =
  "Retain financial metadata for audit purposes while anonymizing supporterName/supporterEmail on consent revocation or deletion requests.";

function getRetentionState(isAnonymized: boolean): string {
  return isAnonymized ? "ANONYMIZED" : "ACTIVE";
}

type UpsertDonationInput = {
  amountMinor: number;
  currency: string;
  status: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  supporterName: string | null;
  supporterEmail: string | null;
  playerId: string | null;
};

export async function upsertSupportDonation(input: UpsertDonationInput) {
  const existingDonation = await prisma.supportDonation.findUnique({
    where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
    select: {
      anonymizedAt: true,
      deletedAt: true,
      consentRevoked: true,
    },
  });

  const shouldSuppressPii =
    !!existingDonation?.anonymizedAt || !!existingDonation?.deletedAt || !!existingDonation?.consentRevoked;

  const donation = await prisma.supportDonation.upsert({
    where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
    update: {
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: input.status,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeCustomerId: input.stripeCustomerId,
      supporterName: shouldSuppressPii ? null : input.supporterName,
      supporterEmail: shouldSuppressPii ? null : input.supporterEmail,
      playerId: input.playerId,
      retentionState: getRetentionState(shouldSuppressPii),
    },
    create: {
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: input.status,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeCustomerId: input.stripeCustomerId,
      supporterName: shouldSuppressPii ? null : input.supporterName,
      supporterEmail: shouldSuppressPii ? null : input.supporterEmail,
      playerId: input.playerId,
      retentionState: getRetentionState(shouldSuppressPii),
    },
  });

  logger.info(
    {
      donationId: donation.id,
      stripeCheckoutSessionId: donation.stripeCheckoutSessionId,
      status: donation.status,
      retentionState: donation.retentionState,
    },
    "Persisted support donation webhook event",
  );

  return donation;
}

export async function anonymizeSupportDonationById(
  donationId: string,
  reason: "right_to_deletion" | "consent_revoked" = "right_to_deletion",
) {
  const donation = await prisma.supportDonation.update({
    where: { id: donationId },
    data: {
      supporterName: null,
      supporterEmail: null,
      consentRevoked: reason === "consent_revoked",
      anonymizedAt: new Date(),
      retentionState: "ANONYMIZED",
    },
  });

  logger.info(
    {
      donationId,
      reason,
      worker: DONATION_RETENTION_WORKER,
      retentionState: donation.retentionState,
    },
    "Anonymized support donation PII",
  );

  return donation;
}

export async function listPublicSupporters() {
  const donations = await prisma.supportDonation.findMany({
    where: {
      status: "succeeded",
      anonymizedAt: null,
      deletedAt: null,
      consentRevoked: false,
    },
    select: {
      id: true,
      supporterName: true,
      createdAt: true,
      player: {
        select: {
          ingameName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const supporterMap = new Map<string, { id: string; name: string; lastDonationAt: Date }>();
  for (const donation of donations) {
    const rawName = donation.player?.ingameName || donation.supporterName;
    const name = rawName?.trim();
    if (!name) {
      continue;
    }

    if (!supporterMap.has(name)) {
      supporterMap.set(name, {
        id: donation.id,
        name,
        lastDonationAt: donation.createdAt,
      });
    }
  }

  const supporters = Array.from(supporterMap.values())
    .sort((a, b) => b.lastDonationAt.getTime() - a.lastDonationAt.getTime())
    .slice(0, 12)
    .map((item) => ({ id: item.id, name: item.name }));

  logger.info({ count: supporters.length }, "Read public supporter list");

  return supporters;
}

export async function listSupportDonationsWithPiiForAdmin() {
  const actor = await requireBotAdmin();
  logger.info({ actorId: actor.id }, "Read support donations with PII");

  return prisma.supportDonation.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amountMinor: true,
      currency: true,
      status: true,
      supporterName: true,
      supporterEmail: true,
      retentionState: true,
      anonymizedAt: true,
      deletedAt: true,
      consentRevoked: true,
      createdAt: true,
    },
  });
}
