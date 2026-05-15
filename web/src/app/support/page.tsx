import SupportPageClient from "./SupportPageClient";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMonthlyTargetMinor, getCurrentMonthCoveredMinor } from "@/lib/support-config";
import { listTopSupporters } from "@/lib/support-donations";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export default async function SupportPage() {
  const session = await auth();
  const discordId = session?.user?.discordId ?? null;

  const [stripeCustomerDonations, targetMinor, coveredMinor, topSupporters] = await Promise.all([
    discordId
      ? prisma.supportDonation.findMany({
          where: { discordId, stripeCustomerId: { not: null } },
          select: {
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripeSubscriptionStatus: true,
            amountMinor: true,
            supporterName: true,
            player: { select: { ingameName: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : null,
    getMonthlyTargetMinor(),
    getCurrentMonthCoveredMinor(),
    listTopSupporters(3),
  ]);

  const stripeCustomerDonation = stripeCustomerDonations?.[0] ?? null;
  const activeSubscriptionDonation =
    stripeCustomerDonations?.find(
      (donation) =>
        !!donation.stripeSubscriptionId &&
        !!donation.stripeSubscriptionStatus &&
        ACTIVE_SUBSCRIPTION_STATUSES.includes(donation.stripeSubscriptionStatus),
    ) ?? null;

  const currentUserName =
    activeSubscriptionDonation?.player?.ingameName ??
    activeSubscriptionDonation?.supporterName ??
    stripeCustomerDonation?.player?.ingameName ??
    stripeCustomerDonation?.supporterName ??
    null;
  const subscriptionTierMinor = activeSubscriptionDonation
    ? activeSubscriptionDonation.amountMinor
    : null;
  const supporterRank =
    currentUserName
      ? (topSupporters.find((s) => s.name === currentUserName)?.rank ?? null)
      : null;

  return (
    <SupportPageClient
      isLoggedIn={!!session?.user}
      stripeCustomerId={stripeCustomerDonation?.stripeCustomerId ?? null}
      coveredMinor={coveredMinor}
      targetMinor={targetMinor}
      topSupporters={topSupporters}
      subscriptionTierMinor={subscriptionTierMinor}
      supporterRank={supporterRank}
      currentUserName={currentUserName}
    />
  );
}
