import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ensureAdmin } from "../actions";
import { getMonthlyTargetMinor, getCurrentMonthCoveredMinor } from "@/lib/support-config";
import { updateMonthlyCostAction } from "./actions";
import { prisma } from "@/lib/prisma";
import { DollarSign, TrendingUp, Users, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Support Config - CereBro Admin",
  description: "Configure monthly cost target and view funding progress.",
};

export default async function AdminSupportPage() {
  await ensureAdmin("MANAGE_SYSTEM");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const [targetMinor, coveredMinor, monthlyDonations, subscriberCount] = await Promise.all([
    getMonthlyTargetMinor(),
    getCurrentMonthCoveredMinor(),
    prisma.supportDonation.findMany({
      where: { status: "succeeded", createdAt: { gte: monthStart } },
      select: { amountMinor: true, currency: true, supporterName: true, createdAt: true, stripeSubscriptionId: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportDonation.groupBy({
      by: ["stripeSubscriptionId"],
      where: { stripeSubscriptionId: { not: null }, status: "succeeded" },
      _count: true,
    }).then((rows) => rows.length),
  ]);

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
              <Users className="w-3.5 h-3.5" /> Historical subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{subscriberCount}</p>
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

      {/* This month's donations */}
      <Card>
        <CardHeader>
          <CardTitle>Donations — {monthLabel}</CardTitle>
          <CardDescription>{monthlyDonations.length} transaction{monthlyDonations.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyDonations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No donations yet this month.</p>
          ) : (
            <div className="space-y-2">
              {monthlyDonations.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
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
                    €{(d.amountMinor / 100).toFixed(2)}
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
