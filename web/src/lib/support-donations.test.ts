import { describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  supportDonation: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth-helpers", () => ({ requireBotAdmin: vi.fn() }));

import { listTopSupporters } from "./support-donations";

describe("support donations", () => {
  it("merges top supporter totals across player, discord, Stripe customer, subscription, email, and name aliases", async () => {
    prismaFake.supportDonation.findMany.mockResolvedValueOnce([
      {
        amountMinor: 500,
        supporterName: "Alex Example",
        supporterEmail: "alex@example.com",
        playerId: null,
        botUserId: null,
        discordId: null,
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        createdAt: new Date(2026, 2, 10, 12),
        player: null,
      },
      {
        amountMinor: 1000,
        supporterName: "Alex Example",
        supporterEmail: "alex@example.com",
        playerId: "player_1",
        botUserId: "bot_1",
        discordId: "discord_1",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        createdAt: new Date(2026, 3, 10, 12),
        player: { ingameName: "AlexMC" },
      },
      {
        amountMinor: 2500,
        supporterName: "Blair",
        supporterEmail: "blair@example.com",
        playerId: "player_2",
        botUserId: null,
        discordId: "discord_2",
        stripeCustomerId: "cus_2",
        stripeSubscriptionId: null,
        createdAt: new Date(2026, 4, 10, 12),
        player: { ingameName: "BlairMC" },
      },
    ]);

    await expect(listTopSupporters(3)).resolves.toEqual([
      { rank: 1, name: "BlairMC", totalMinor: 2500 },
      { rank: 2, name: "AlexMC", totalMinor: 1500 },
    ]);
  });
});
