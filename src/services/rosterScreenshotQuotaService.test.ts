import { describe, expect, it } from "vitest";
import {
  ALLIANCE_UNLOCK_THRESHOLD_MINOR,
  FREE_SCREENSHOT_MONTHLY_LIMIT,
  PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR,
  getRosterScreenshotQuota,
} from "./rosterScreenshotQuotaService.js";

type UploadEvent = {
  fileCount: number;
  createdAt: Date;
  actorPlayerId?: string | null;
  actorBotUserId?: string | null;
  discordUserId?: string | null;
};

type Donation = {
  id: string;
  amountMinor: number;
  status: string;
  createdAt: Date;
  playerId?: string | null;
  botUserId?: string | null;
  discordId?: string | null;
};

function inRange(date: Date, range: { gte?: Date; lt?: Date }) {
  return (!range.gte || date >= range.gte) && (!range.lt || date < range.lt);
}

function matchesOr<T extends Record<string, unknown>>(row: T, ors: Array<Record<string, unknown>> | undefined) {
  if (!ors || ors.length === 0) return true;
  return ors.some((clause) =>
    Object.entries(clause).every(([key, value]) => row[key] === value)
  );
}

function createPrismaFake({
  uploadEvents = [],
  donations = [],
  playerAlliance = {},
}: {
  uploadEvents?: UploadEvent[];
  donations?: Donation[];
  playerAlliance?: Record<string, string | null>;
}) {
  return {
    rosterUploadEvent: {
      aggregate: async ({ where }: { where: { createdAt: { gte?: Date; lt?: Date }; OR?: Array<Record<string, unknown>> } }) => ({
        _sum: {
          fileCount: uploadEvents
            .filter((event) => inRange(event.createdAt, where.createdAt))
            .filter((event) => matchesOr(event, where.OR))
            .reduce((sum, event) => sum + event.fileCount, 0),
        },
      }),
    },
    supportDonation: {
      findFirst: async ({ where }: { where: { status: string; createdAt: { gte?: Date; lt?: Date }; OR?: Array<Record<string, unknown>> } }) =>
        donations.find((donation) =>
          donation.status === where.status &&
          inRange(donation.createdAt, where.createdAt) &&
          matchesOr(donation, where.OR)
        ) ?? null,
      aggregate: async ({ where }: { where: { status: string; createdAt?: { gte?: Date; lt?: Date }; OR?: Array<Record<string, unknown>>; player?: { allianceId?: string | null } } }) => ({
        _sum: {
          amountMinor: donations
            .filter((donation) => donation.status === where.status)
            .filter((donation) => !where.createdAt || inRange(donation.createdAt, where.createdAt))
            .filter((donation) => matchesOr(donation, where.OR))
            .filter((donation) => !where.player?.allianceId || !!donation.playerId && playerAlliance[donation.playerId] === where.player.allianceId)
            .reduce((sum, donation) => sum + donation.amountMinor, 0),
        },
      }),
    },
  } as never;
}

const now = new Date(2026, 4, 13, 12);
const currentMonth = new Date(2026, 4, 5, 12);
const previousMonth = new Date(2026, 3, 25, 12);
const actor = { playerId: "player-1", botUserId: "bot-1", discordId: "discord-1", allianceId: "alliance-1" };

describe("roster screenshot quota", () => {
  it("allows a free actor under the monthly limit", async () => {
    const quota = await getRosterScreenshotQuota(actor, 2, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 2, createdAt: currentMonth, actorPlayerId: actor.playerId }],
      }),
    });

    expect(quota.allowed).toBe(true);
    expect(quota.used).toBe(2);
    expect(quota.remaining).toBe(3);
  });

  it("blocks the whole batch when a free actor would exceed the monthly limit", async () => {
    const quota = await getRosterScreenshotQuota(actor, 2, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 4, createdAt: currentMonth, actorPlayerId: actor.playerId }],
      }),
    });

    expect(quota.allowed).toBe(false);
    expect(quota.reason).toBe("free_limit_exceeded");
    expect(quota.remaining).toBe(1);
  });

  it("allows the exact free monthly limit boundary", async () => {
    const quota = await getRosterScreenshotQuota(actor, 2, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: FREE_SCREENSHOT_MONTHLY_LIMIT - 2, createdAt: currentMonth, actorPlayerId: actor.playerId }],
      }),
    });

    expect(quota.allowed).toBe(true);
    expect(quota.used + quota.requested).toBe(FREE_SCREENSHOT_MONTHLY_LIMIT);
  });

  it("bypasses the limit for a current-month personal supporter", async () => {
    const quota = await getRosterScreenshotQuota(actor, 5, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 5, createdAt: currentMonth, actorPlayerId: actor.playerId }],
        donations: [{ id: "donation-1", amountMinor: 500, status: "succeeded", createdAt: currentMonth, playerId: actor.playerId }],
      }),
    });

    expect(quota.allowed).toBe(true);
    expect(quota.unlimitedReason).toBe("personal_supporter");
  });

  it("bypasses the limit for at least 10 EUR lifetime personal donations", async () => {
    const quota = await getRosterScreenshotQuota(actor, 5, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 5, createdAt: currentMonth, actorPlayerId: actor.playerId }],
        donations: [
          { id: "donation-1", amountMinor: 400, status: "succeeded", createdAt: previousMonth, playerId: actor.playerId },
          { id: "donation-2", amountMinor: PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR - 400, status: "succeeded", createdAt: previousMonth, discordId: actor.discordId },
        ],
      }),
    });

    expect(quota.allowed).toBe(true);
    expect(quota.unlimitedReason).toBe("personal_lifetime_supporter");
    expect(quota.personalLifetimeMinor).toBe(PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR);
  });

  it("does not bypass the limit for less than 10 EUR lifetime personal donations without current-month support", async () => {
    const quota = await getRosterScreenshotQuota(actor, 1, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 5, createdAt: currentMonth, actorPlayerId: actor.playerId }],
        donations: [
          { id: "donation-1", amountMinor: PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR - 1, status: "succeeded", createdAt: previousMonth, playerId: actor.playerId },
        ],
      }),
    });

    expect(quota.allowed).toBe(false);
    expect(quota.personalLifetimeMinor).toBe(PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR - 1);
  });

  it("bypasses the limit when current alliance donations reach the unlock threshold", async () => {
    const quota = await getRosterScreenshotQuota(actor, 5, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 5, createdAt: currentMonth, actorPlayerId: actor.playerId }],
        playerAlliance: { donor1: "alliance-1", donor2: "alliance-1" },
        donations: [
          { id: "donation-1", amountMinor: 1000, status: "succeeded", createdAt: currentMonth, playerId: "donor1" },
          { id: "donation-2", amountMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR - 1000, status: "succeeded", createdAt: currentMonth, playerId: "donor2" },
        ],
      }),
    });

    expect(quota.allowed).toBe(true);
    expect(quota.unlimitedReason).toBe("alliance_unlocked");
  });

  it("does not count previous-month donations toward the current alliance unlock", async () => {
    const quota = await getRosterScreenshotQuota(actor, 1, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 5, createdAt: currentMonth, actorPlayerId: actor.playerId }],
        playerAlliance: { donor1: "alliance-1" },
        donations: [{ id: "donation-1", amountMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR, status: "succeeded", createdAt: previousMonth, playerId: "donor1" }],
      }),
    });

    expect(quota.allowed).toBe(false);
    expect(quota.allianceCurrentMonthMinor).toBe(0);
  });

  it("does not count donations from members of other alliances", async () => {
    const quota = await getRosterScreenshotQuota(actor, 1, {
      now,
      prisma: createPrismaFake({
        uploadEvents: [{ fileCount: 5, createdAt: currentMonth, actorPlayerId: actor.playerId }],
        playerAlliance: { donor1: "alliance-2" },
        donations: [{ id: "donation-1", amountMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR, status: "succeeded", createdAt: currentMonth, playerId: "donor1" }],
      }),
    });

    expect(quota.allowed).toBe(false);
    expect(quota.allianceCurrentMonthMinor).toBe(0);
  });
});
