import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  $transaction: vi.fn(),
  supportDonation: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  player: {
    findUnique: vi.fn(),
  },
  botJob: {
    upsert: vi.fn(),
  },
}));

const adminFake = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

const loggerFake = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/support-config", () => ({ setMonthlyTargetEur: vi.fn() }));
vi.mock("../actions", () => adminFake);
vi.mock("@/lib/logger", () => ({ default: loggerFake }));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => cacheFake);

import { linkSupportDonationToPlayerAction } from "./actions";

function formData(input: { donationId?: string; playerId?: string }) {
  const data = new FormData();
  if (input.donationId !== undefined) data.set("donationId", input.donationId);
  if (input.playerId !== undefined) data.set("playerId", input.playerId);
  return data;
}

function unlinkedDonation(overrides: Record<string, unknown> = {}) {
  return {
    id: "donation_1",
    status: "succeeded",
    playerId: null,
    botUserId: null,
    discordId: null,
    anonymizedAt: null,
    deletedAt: null,
    consentRevoked: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    ...overrides,
  };
}

const player = {
  id: "player_1",
  ingameName: "Summoner",
  discordId: "discord_1",
  botUserId: "bot_1",
};

describe("admin support actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminFake.ensureAdmin.mockResolvedValue({ id: "admin_1" });
    prismaFake.supportDonation.findUnique.mockResolvedValue(unlinkedDonation());
    prismaFake.player.findUnique.mockResolvedValue(player);
    prismaFake.supportDonation.updateMany.mockResolvedValue({ count: 1 });
    prismaFake.botJob.upsert.mockResolvedValue({ id: "job_1" });
    prismaFake.$transaction.mockImplementation(async (fn: (tx: typeof prismaFake) => Promise<unknown>) => fn(prismaFake));
  });

  it("links a one-time unlinked donation to a player", async () => {
    await expect(linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" })))
      .resolves.toEqual({ success: true, updatedCount: 1 });

    expect(adminFake.ensureAdmin).toHaveBeenCalledWith("MANAGE_SYSTEM");
    expect(prismaFake.supportDonation.updateMany).toHaveBeenCalledWith({
      where: {
        status: "succeeded",
        playerId: null,
        botUserId: null,
        discordId: null,
        anonymizedAt: null,
        deletedAt: null,
        consentRevoked: false,
        id: "donation_1",
      },
      data: {
        playerId: "player_1",
        botUserId: "bot_1",
        discordId: "discord_1",
      },
    });
    expect(prismaFake.botJob.upsert).toHaveBeenCalledWith({
      where: {
        type_referenceId: {
          type: "ASSIGN_SUPPORTER_ROLE",
          referenceId: "manual-support-link:donation_1",
        },
      },
      update: {
        status: "PENDING",
        payload: {
          discordId: "discord_1",
          donationId: "donation_1",
          playerId: "player_1",
          source: "admin_manual_link",
        },
        error: null,
      },
      create: {
        type: "ASSIGN_SUPPORTER_ROLE",
        referenceId: "manual-support-link:donation_1",
        payload: {
          discordId: "discord_1",
          donationId: "donation_1",
          playerId: "player_1",
          source: "admin_manual_link",
        },
      },
    });
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/admin/support");
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/support");
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/alliance");
  });

  it("links related unlinked subscription rows", async () => {
    prismaFake.supportDonation.findUnique.mockResolvedValueOnce(
      unlinkedDonation({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" }),
    );
    prismaFake.supportDonation.updateMany.mockResolvedValueOnce({ count: 3 });

    await expect(linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" })))
      .resolves.toEqual({ success: true, updatedCount: 3 });

    expect(prismaFake.supportDonation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stripeSubscriptionId: "sub_1",
          playerId: null,
          botUserId: null,
          discordId: null,
          anonymizedAt: null,
          deletedAt: null,
          consentRevoked: false,
          status: "succeeded",
        }),
      }),
    );
  });

  it("links related unlinked customer rows when no subscription id exists", async () => {
    prismaFake.supportDonation.findUnique.mockResolvedValueOnce(
      unlinkedDonation({ stripeCustomerId: "cus_1", stripeSubscriptionId: null }),
    );

    await linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" }));

    expect(prismaFake.supportDonation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stripeCustomerId: "cus_1",
          playerId: null,
          botUserId: null,
          discordId: null,
        }),
      }),
    );
  });

  it("rejects already-linked donations", async () => {
    prismaFake.supportDonation.findUnique.mockResolvedValueOnce(unlinkedDonation({ playerId: "player_existing" }));

    await expect(linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" })))
      .rejects.toThrow("This donation is already linked.");

    expect(prismaFake.supportDonation.updateMany).not.toHaveBeenCalled();
    expect(prismaFake.botJob.upsert).not.toHaveBeenCalled();
  });

  it("rejects suppressed donations", async () => {
    prismaFake.supportDonation.findUnique.mockResolvedValueOnce(
      unlinkedDonation({ anonymizedAt: new Date("2026-06-01T00:00:00.000Z") }),
    );

    await expect(linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" })))
      .rejects.toThrow("This donation cannot be linked because supporter data is suppressed.");

    expect(prismaFake.supportDonation.updateMany).not.toHaveBeenCalled();
    expect(prismaFake.botJob.upsert).not.toHaveBeenCalled();
  });

  it("rejects non-succeeded donations", async () => {
    prismaFake.supportDonation.findUnique.mockResolvedValueOnce(unlinkedDonation({ status: "open" }));

    await expect(linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" })))
      .rejects.toThrow("Only succeeded donations can be linked.");

    expect(prismaFake.supportDonation.updateMany).not.toHaveBeenCalled();
    expect(prismaFake.botJob.upsert).not.toHaveBeenCalled();
  });

  it("rejects missing players", async () => {
    prismaFake.player.findUnique.mockResolvedValueOnce(null);

    await expect(linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_missing" })))
      .rejects.toThrow("Player not found.");

    expect(prismaFake.supportDonation.updateMany).not.toHaveBeenCalled();
    expect(prismaFake.botJob.upsert).not.toHaveBeenCalled();
  });

  it("resets an existing manual supporter-role job to pending", async () => {
    await linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" }));

    expect(prismaFake.botJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "PENDING",
          error: null,
        }),
      }),
    );
  });

  it("rejects when no unlinked donation rows were updated", async () => {
    prismaFake.supportDonation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(linkSupportDonationToPlayerAction(formData({ donationId: "donation_1", playerId: "player_1" })))
      .rejects.toThrow("No unlinked donation rows were updated.");

    expect(prismaFake.botJob.upsert).not.toHaveBeenCalled();
  });
});
