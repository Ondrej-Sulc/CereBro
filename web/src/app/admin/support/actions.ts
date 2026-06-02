"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setMonthlyTargetEur } from "@/lib/support-config";
import { ensureAdmin } from "../actions";
import { withActionContext } from "@/lib/with-request-context";
import logger from "@/lib/logger";

export type LinkSupportDonationResult = {
  success: true;
  updatedCount: number;
};

export const updateMonthlyCostAction = withActionContext('updateMonthlyCostAction', async (formData: FormData) => {
  await ensureAdmin("MANAGE_SYSTEM");

  const raw = formData.get("monthly_cost_eur");
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0 || value > 10000) {
    throw new Error("Invalid value: must be a finite number >0 and <=10000");
  }

  await setMonthlyTargetEur(value);
  revalidatePath("/admin/support");
  revalidatePath("/support");
});

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid value: ${key} is required.`);
  }
  return value.trim();
}

function visibleUnlinkedSucceededDonationWhere(): Prisma.SupportDonationWhereInput {
  return {
    status: "succeeded",
    playerId: null,
    botUserId: null,
    discordId: null,
    anonymizedAt: null,
    deletedAt: null,
    consentRevoked: false,
  };
}

export const linkSupportDonationToPlayerAction = withActionContext(
  "linkSupportDonationToPlayerAction",
  async (formData: FormData): Promise<LinkSupportDonationResult> => {
    const actor = await ensureAdmin("MANAGE_SYSTEM");

    const donationId = readRequiredString(formData, "donationId");
    const playerId = readRequiredString(formData, "playerId");

    const donation = await prisma.supportDonation.findUnique({
      where: { id: donationId },
      select: {
        id: true,
        status: true,
        playerId: true,
        botUserId: true,
        discordId: true,
        anonymizedAt: true,
        deletedAt: true,
        consentRevoked: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!donation) {
      throw new Error("Donation not found.");
    }
    if (donation.status !== "succeeded") {
      throw new Error("Only succeeded donations can be linked.");
    }
    if (donation.playerId || donation.botUserId || donation.discordId) {
      throw new Error("This donation is already linked.");
    }
    if (donation.anonymizedAt || donation.deletedAt || donation.consentRevoked) {
      throw new Error("This donation cannot be linked because supporter data is suppressed.");
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        ingameName: true,
        discordId: true,
        botUserId: true,
      },
    });

    if (!player) {
      throw new Error("Player not found.");
    }

    const relatedDonationWhere: Prisma.SupportDonationWhereInput = {
      ...visibleUnlinkedSucceededDonationWhere(),
      ...(donation.stripeSubscriptionId
        ? { stripeSubscriptionId: donation.stripeSubscriptionId }
        : donation.stripeCustomerId
          ? { stripeCustomerId: donation.stripeCustomerId }
          : { id: donationId }),
    };

    const payload = {
      discordId: player.discordId,
      donationId,
      playerId: player.id,
      source: "admin_manual_link",
    };

    const updatedCount = await prisma.$transaction(async (tx) => {
      const update = await tx.supportDonation.updateMany({
        where: relatedDonationWhere,
        data: {
          playerId: player.id,
          botUserId: player.botUserId,
          discordId: player.discordId,
        },
      });

      if (update.count === 0) {
        throw new Error("No unlinked donation rows were updated.");
      }

      await tx.botJob.upsert({
        where: {
          type_referenceId: {
            type: "ASSIGN_SUPPORTER_ROLE",
            referenceId: `manual-support-link:${donationId}`,
          },
        },
        update: {
          status: "PENDING",
          payload,
          error: null,
        },
        create: {
          type: "ASSIGN_SUPPORTER_ROLE",
          referenceId: `manual-support-link:${donationId}`,
          payload,
        },
      });

      return update.count;
    });

    logger.info(
      {
        actorId: actor.id,
        donationId,
        playerId: player.id,
        playerName: player.ingameName,
        updatedCount,
        stripeCustomerId: donation.stripeCustomerId,
        stripeSubscriptionId: donation.stripeSubscriptionId,
      },
      "Linked support donation to player from admin tool",
    );

    revalidatePath("/admin/support");
    revalidatePath("/support");
    revalidatePath("/alliance");

    return { success: true, updatedCount };
  },
);
