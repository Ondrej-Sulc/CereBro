import SupportPageClient from "./SupportPageClient";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMonthlyTargetMinor, getCurrentMonthCoveredMinor } from "@/lib/support-config";
import { listTopSupporters } from "@/lib/support-donations";

export default async function SupportPage() {
  const session = await auth();
  const discordId = session?.user?.discordId ?? null;

  const [stripeCustomerDonation, targetMinor, coveredMinor, topSupporters] = await Promise.all([
    discordId
      ? prisma.supportDonation.findFirst({
          where: { discordId, stripeCustomerId: { not: null } },
          select: { stripeCustomerId: true },
          orderBy: { createdAt: "desc" },
        })
      : null,
    getMonthlyTargetMinor(),
    getCurrentMonthCoveredMinor(),
    listTopSupporters(3),
  ]);

  return (
    <SupportPageClient
      isLoggedIn={!!session?.user}
      stripeCustomerId={stripeCustomerDonation?.stripeCustomerId ?? null}
      coveredMinor={coveredMinor}
      targetMinor={targetMinor}
      topSupporters={topSupporters}
    />
  );
}
