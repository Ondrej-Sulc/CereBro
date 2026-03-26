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

  const result = await prisma.supportDonation.aggregate({
    where: {
      status: "succeeded",
      createdAt: { gte: monthStart },
    },
    _sum: { amountMinor: true },
  });

  return result._sum.amountMinor ?? 0;
}
