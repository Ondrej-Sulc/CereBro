import { prisma } from "@/lib/prisma";

const MONTHLY_COST_KEY = "monthly_cost_eur";

export async function getMonthlyTargetMinor(): Promise<number | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: MONTHLY_COST_KEY },
  });
  if (!config) return null;
  const parsed = Number(config.value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

export async function setMonthlyTargetEur(eur: number): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: MONTHLY_COST_KEY },
    update: { value: String(eur) },
    create: { key: MONTHLY_COST_KEY, value: String(eur) },
  });
}

export async function getCurrentMonthCoveredMinor(): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const donations = await prisma.supportDonation.findMany({
    where: {
      status: "succeeded",
      anonymizedAt: null,
      deletedAt: null,
      consentRevoked: false,
      OR: [
        { createdAt: { gte: monthStart } },
        {
          stripeSubscriptionId: { not: null },
          stripeSubscriptionStatus: { in: ["active", "trialing", "past_due"] },
        },
      ],
    },
    select: {
      amountMinor: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });

  let coveredMinor = 0;
  const latestSubscriptionDonations = new Map<string, { amountMinor: number; createdAt: Date }>();

  for (const donation of donations) {
    if (!donation.stripeSubscriptionId) {
      if (donation.createdAt >= monthStart) {
        coveredMinor += donation.amountMinor;
      }
      continue;
    }

    const existing = latestSubscriptionDonations.get(donation.stripeSubscriptionId);
    if (!existing || donation.createdAt > existing.createdAt) {
      latestSubscriptionDonations.set(donation.stripeSubscriptionId, {
        amountMinor: donation.amountMinor,
        createdAt: donation.createdAt,
      });
    }
  }

  for (const donation of latestSubscriptionDonations.values()) {
    coveredMinor += donation.amountMinor;
  }

  return coveredMinor;
}
