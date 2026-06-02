import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALLIANCE_UNLOCK_THRESHOLD_MINOR } from "@cerebro/core/services/rosterScreenshotQuotaService";

const prismaFake = vi.hoisted(() => ({
  supportDonation: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));

import { getAllianceScreenshotUnlockStatus } from "./support-status";

describe("support status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts alliance screenshot support from the last 30 days across a month boundary", async () => {
    const now = new Date(2026, 5, 2, 12);
    const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    prismaFake.supportDonation.findMany.mockResolvedValueOnce([
      {
        amountMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR,
        stripeSubscriptionId: null,
        createdAt: new Date(2026, 4, 31, 12),
      },
    ]);

    await expect(getAllianceScreenshotUnlockStatus("alliance-1", now)).resolves.toMatchObject({
      currentMonthMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR,
      thresholdMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR,
      unlocked: true,
    });

    expect(prismaFake.supportDonation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          player: { allianceId: "alliance-1" },
          OR: expect.arrayContaining([
            { createdAt: { gte: windowStart, lt: now } },
          ]),
        }),
      }),
    );
  });
});
