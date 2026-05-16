import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ensureAdmin } from "../actions";
import { getMonthlyTargetMinor, getCurrentMonthCoveredMinor } from "@/lib/support-config";
import { updateMonthlyCostAction } from "./actions";
import { prisma } from "@/lib/prisma";
import { DollarSign, TrendingUp, Users, AlertCircle, CreditCard } from "lucide-react";

export const metadata: Metadata = {
  title: "Support Config - CereBro Admin",
  description: "Configure monthly cost target and view funding progress.",
};

const CURRENT_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);
const SUBSCRIPTION_STATUS_PRIORITY: Record<string, number> = {
  past_due: 0,
  trialing: 1,
  active: 2,
};

function formatCurrencyMinor(amountMinor: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getSubscriberName(subscriber: {
  player: { ingameName: string | null } | null;
  supporterName: string | null;
}) {
  return subscriber.player?.ingameName?.trim() || subscriber.supporterName?.trim() || "Anonymous";
}

export default async function AdminSupportPage() {
  await ensureAdmin("MANAGE_SYSTEM");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const [targetMinor, coveredMinor, monthlyDonations, subscriptionDonations] = await Promise.all([
    getMonthlyTargetMinor(),
    getCurrentMonthCoveredMinor(),
    prisma.supportDonation.findMany({
      where: { status: "succeeded", createdAt: { gte: monthStart } },
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        supporterName: true,
        createdAt: true,
        stripeSubscriptionId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportDonation.findMany({
      where: {
        stripeSubscriptionId: { not: null },
        status: "succeeded",
      },
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        supporterName: true,
        supporterEmail: true,
        discordId: true,
        botUserId: true,
        playerId: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        createdAt: true,
        player: { select: { ingameName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const latestBySubscription = new Map<string, (typeof subscriptionDonations)[number]>();

  for (const donation of subscriptionDonations) {
    if (!donation.stripeSubscriptionId) continue;

    const existing = latestBySubscription.get(donation.stripeSubscriptionId);
    if (!existing || donation.createdAt > existing.createdAt) {
      latestBySubscription.set(donation.stripeSubscriptionId, donation);
    }
  }

  const currentSubscribers = Array.from(latestBySubscription.values())
    .filter(
      (subscriber) =>
        !!subscriber.stripeSubscriptionStatus &&
        CURRENT_SUBSCRIPTION_STATUSES.has(subscriber.stripeSubscriptionStatus),
    )
    .sort((a, b) => {
      const aPriority = SUBSCRIPTION_STATUS_PRIORITY[a.stripeSubscriptionStatus ?? ""] ?? 99;
      const bPriority = SUBSCRIPTION_STATUS_PRIORITY[b.stripeSubscriptionStatus ?? ""] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const targetEur = targetMinor ? targetMinor / 100 : null;
  const coveredEur = coveredMinor / 100;
  const barsCleared = targetMinor && targetMinor > 0 ? Math.floor(coveredMinor / targetMinor) : 0;
  const fillPct = targetMinor && targetMinor > 0
    ? Math.round(((coveredMinor % targetMinor) / targetMinor) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">Manage the monthly cost target and monitor funding progress.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Monthly target
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {targetEur ? `€${targetEur.toFixed(0)}` : <span className="text-muted-foreground text-base">Not set</span>}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Covered — {monthLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">€{coveredEur.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Cleared
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {targetMinor ? barsCleared : <span className="text-muted-foreground text-base">N/A</span>}
            </p>
            {targetMinor && barsCleared === 0 && (
              <p className="text-xs text-muted-foreground">{fillPct}% toward first time</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Current subscribers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentSubscribers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Target config */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Cost Target</CardTitle>
          <CardDescription>
            Set the total monthly hosting + API costs in EUR. This drives the progress bar on the public support page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateMonthlyCostAction} className="flex items-end gap-3 max-w-sm">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="monthly_cost_eur" className="text-sm font-medium">
                Monthly cost (EUR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                <Input
                  id="monthly_cost_eur"
                  name="monthly_cost_eur"
                  type="number"
                  min="1"
                  step="0.01"
                  defaultValue={targetEur ?? ""}
                  placeholder="e.g. 120"
                  className="pl-7"
                />
              </div>
            </div>
            <Button type="submit">Save</Button>
          </form>

          {!targetEur && (
            <div className="flex items-center gap-2 mt-4 text-sm text-amber-500">
              <AlertCircle className="w-4 h-4" />
              No target set — the funding bar will not be shown on the support page until you save a value.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current subscribers */}
      <Card>
        <CardHeader>
          <CardTitle>Current Subscribers</CardTitle>
          <CardDescription>
            Active, trialing, and past-due subscriptions based on the latest stored Stripe subscription status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentSubscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No current subscribers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Supporter</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium text-right">Monthly</th>
                    <th className="py-2 pr-4 font-medium">Last paid</th>
                    <th className="py-2 pr-4 font-medium">Stripe</th>
                    <th className="py-2 font-medium">Linked identity</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSubscribers.map((subscriber) => {
                    const status = subscriber.stripeSubscriptionStatus ?? "unknown";
                    const statusVariant = status === "past_due" ? "destructive" : "secondary";

                    return (
                      <tr key={subscriber.stripeSubscriptionId} className="border-b border-border/40 last:border-0 align-top">
                        <td className="py-3 pr-4">
                          <div className="font-medium">{getSubscriberName(subscriber)}</div>
                          {subscriber.supporterEmail && (
                            <div className="text-xs text-muted-foreground">{subscriber.supporterEmail}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={statusVariant} className="capitalize">
                            {status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right font-medium tabular-nums">
                          {formatCurrencyMinor(subscriber.amountMinor, subscriber.currency)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatDate(subscriber.createdAt)}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="space-y-1 font-mono text-xs text-muted-foreground">
                            {subscriber.stripeCustomerId && <div>{subscriber.stripeCustomerId}</div>}
                            {subscriber.stripeSubscriptionId && <div>{subscriber.stripeSubscriptionId}</div>}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {subscriber.playerId && <div>player: {subscriber.playerId}</div>}
                            {subscriber.botUserId && <div>bot: {subscriber.botUserId}</div>}
                            {subscriber.discordId && <div>discord: {subscriber.discordId}</div>}
                            {!subscriber.playerId && !subscriber.botUserId && !subscriber.discordId && (
                              <span className="italic">No linked account</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* This month's donations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payments — {monthLabel}
          </CardTitle>
          <CardDescription>
            Actual succeeded payments this month. Subscriber state is shown separately above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyDonations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No payments yet this month.</p>
          ) : (
            <div className="space-y-2">
              {monthlyDonations.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {d.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                    <span>{d.supporterName || <span className="italic text-muted-foreground">Anonymous</span>}</span>
                    {d.stripeSubscriptionId && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">recurring</Badge>
                    )}
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatCurrencyMinor(d.amountMinor, d.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
