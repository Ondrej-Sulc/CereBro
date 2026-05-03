import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { requireBotAdmin } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";

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
  stripeSubscriptionId: string | null;
  supporterName: string | null;
  supporterEmail: string | null;
  playerId: string | null;
  botUserId: string | null;
  discordId: string | null;
};

export async function upsertSupportDonation(input: UpsertDonationInput) {
  const donation = await prisma.$transaction(async (tx) => {
    const existingBefore = await tx.supportDonation.findUnique({
      where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
      select: { status: true },
    });

    const commonUpdateData = {
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: input.status,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      playerId: input.playerId,
      botUserId: input.botUserId,
      discordId: input.discordId,
    };

    // Only update with PII when the row is still in an ACTIVE (non-anonymized) state.
    const activeUpdate = await tx.supportDonation.updateMany({
      where: {
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        anonymizedAt: null,
        deletedAt: null,
        consentRevoked: false,
      },
      data: {
        ...commonUpdateData,
        supporterName: input.supporterName,
        supporterEmail: input.supporterEmail,
        retentionState: getRetentionState(false),
      },
    });

    if (activeUpdate.count === 0) {
      // If row exists in suppressed state, keep PII nulled.
      const suppressedUpdate = await tx.supportDonation.updateMany({
        where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
        data: {
          ...commonUpdateData,
          supporterName: null,
          supporterEmail: null,
          retentionState: getRetentionState(true),
        },
      });

      if (suppressedUpdate.count === 0) {
        // No existing row -> create ACTIVE record with current PII.
        try {
          await tx.supportDonation.create({
            data: {
              ...commonUpdateData,
              stripeCheckoutSessionId: input.stripeCheckoutSessionId,
              supporterName: input.supporterName,
              supporterEmail: input.supporterEmail,
              retentionState: getRetentionState(false),
            },
          });
        } catch (error) {
          // Handle unique-race safely by re-applying updates with suppression-aware logic.
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
            throw error;
          }

          const existing = await tx.supportDonation.findUnique({
            where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
            select: {
              id: true,
              anonymizedAt: true,
              deletedAt: true,
              consentRevoked: true,
            },
          });

          if (!existing) {
            throw error;
          }

          const shouldSuppressPii =
            !!existing.anonymizedAt || !!existing.deletedAt || !!existing.consentRevoked;

          await tx.supportDonation.update({
            where: { id: existing.id },
            data: {
              ...commonUpdateData,
              supporterName: shouldSuppressPii ? null : input.supporterName,
              supporterEmail: shouldSuppressPii ? null : input.supporterEmail,
              retentionState: getRetentionState(shouldSuppressPii),
            },
          });
        }
      }
    }

    const persisted = await tx.supportDonation.findUnique({
      where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
    });

    if (!persisted) {
      throw new Error("Support donation upsert failed: record not found after transaction.");
    }

    const targetDiscordId = persisted.discordId || input.discordId;

    if (
      persisted.status === "succeeded" &&
      existingBefore?.status !== "succeeded" &&
      targetDiscordId
    ) {
      try {
        // Enqueue the bot job idempotently using the deterministic referenceId
        await tx.botJob.create({
          data: {
            type: "ASSIGN_SUPPORTER_ROLE",
            referenceId: persisted.id,
            payload: { discordId: targetDiscordId, donationId: persisted.id },
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
        // Unique constraint failed, meaning the job was already enqueued
        // Treated as no-op to ensure idempotency.
      }
    }

    return persisted;
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
  try {
    const donation = await prisma.supportDonation.update({
      where: { id: donationId },
      data: {
        supporterName: null,
        supporterEmail: null,
        // Only set to true if revoked; using undefined skips updating this field in the DB
        consentRevoked: reason === "consent_revoked" ? true : undefined,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      logger.warn(
        { donationId, reason, worker: DONATION_RETENTION_WORKER },
        "Support donation not found during anonymization; treating as no-op",
      );
      return null;
    }

    throw error;
  }
}

export async function listTopSupporters(limit = 3) {
  const donations = await prisma.supportDonation.findMany({
    where: {
      status: "succeeded",
      anonymizedAt: null,
      deletedAt: null,
      consentRevoked: false,
    },
    select: {
      amountMinor: true,
      supporterName: true,
      playerId: true,
      discordId: true,
      createdAt: true,
      player: {
        select: { ingameName: true },
      },
    },
  });

  // Group by canonical identity: playerId > discordId > supporterName
  const totals = new Map<string, { name: string; totalMinor: number; lastAt: Date }>();

  for (const d of donations) {
    const key = d.playerId ?? d.discordId ?? d.supporterName ?? null;
    if (!key) continue;

    let name = d.player?.ingameName?.trim();
    if (!name && d.supporterName) {
      name = d.supporterName.trim();
      if (!d.discordId) {
        // Show only first name if no Discord sign-in
        name = name.split(" ")[0];
      }
    }
    if (!name) continue;

    const existing = totals.get(key);
    if (existing) {
      existing.totalMinor += d.amountMinor;
      // Keep the most recent name (player ingameName may have changed)
      if (d.createdAt > existing.lastAt) {
        existing.name = name;
        existing.lastAt = d.createdAt;
      }
    } else {
      totals.set(key, { name, totalMinor: d.amountMinor, lastAt: d.createdAt });
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.totalMinor - a.totalMinor)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      totalMinor: item.totalMinor,
    }));
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
      discordId: true,
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
    let name = donation.player?.ingameName?.trim();
    if (!name && donation.supporterName) {
      name = donation.supporterName.trim();
      if (!donation.discordId) {
        // Show only first name if no Discord sign-in
        name = name.split(" ")[0];
      }
    }

    if (!name) {
      continue;
    }

    // Deduplicate by original full name/ingameName to prevent multiple entries for same person
    const key = donation.player?.ingameName?.trim() || donation.supporterName?.trim() || name;

    if (!supporterMap.has(key)) {
      supporterMap.set(key, {
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
  const actor = await requireBotAdmin("support:read_donation_pii" as any);
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
