import SupportPageClient from "./SupportPageClient";
import { FundingBar } from "./components/FundingBar";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMonthlyTargetMinor, getCurrentMonthCoveredMinor } from "@/lib/support-config";

export default async function SupportPage() {
  const session = await auth();
  const discordId = session?.user?.discordId ?? null;

  const [stripeCustomerDonation, targetMinor, coveredMinor] = await Promise.all([
    discordId
      ? prisma.supportDonation.findFirst({
          where: { discordId, stripeCustomerId: { not: null } },
          select: { stripeCustomerId: true },
          orderBy: { createdAt: "desc" },
        })
      : null,
    getMonthlyTargetMinor(),
    getCurrentMonthCoveredMinor(),
  ]);

  return (
    <>
      {targetMinor && (
        <FundingBar coveredMinor={coveredMinor} targetMinor={targetMinor} />
      )}
      <SupportPageClient
        isLoggedIn={!!session?.user}
        stripeCustomerId={stripeCustomerDonation?.stripeCustomerId ?? null}
      />
    </>
  );
}
