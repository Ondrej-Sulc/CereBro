import { describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  systemConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  supportDonation: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));

import { getCurrentMonthCoveredMinor } from "./support-config";

describe("support config", () => {
  it("counts current one-time donations plus the latest row for each recurring subscription", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 12));
    prismaFake.supportDonation.findMany.mockResolvedValueOnce([
      {
        amountMinor: 500,
        stripeSubscriptionId: "sub_existing",
        createdAt: new Date(2026, 3, 10, 12),
      },
      {
        amountMinor: 1000,
        stripeSubscriptionId: "sub_changed_tier",
        createdAt: new Date(2026, 3, 10, 12),
      },
      {
        amountMinor: 2500,
        stripeSubscriptionId: "sub_changed_tier",
        createdAt: new Date(2026, 4, 10, 12),
      },
      {
        amountMinor: 1000,
        stripeSubscriptionId: null,
        createdAt: new Date(2026, 4, 9, 12),
      },
    ]);

    await expect(getCurrentMonthCoveredMinor()).resolves.toBe(4000);

    expect(prismaFake.supportDonation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "succeeded",
          anonymizedAt: null,
          deletedAt: null,
          consentRevoked: false,
        }),
      }),
    );

    vi.useRealTimers();
  });
});
