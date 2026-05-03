"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Server, Sparkles, Info, LogIn, Settings, Crown, Trophy, Award, ChevronDown, Lock, ArrowRight } from "lucide-react";
import PageBackground from "@/components/PageBackground";
import { signInAction } from "@/app/actions/auth";
import { FundingBar } from "./components/FundingBar";

const CURRENCY = "EUR";
const SUBSCRIPTION_TIERS = [5, 10, 25, 50] as const;
const SUGGESTED_AMOUNTS = [5, 10, 25, 50, 100];

const TIER_TAGLINES: Record<number, string> = {
  5: "keeps the lights on",
  10: "funds a feature",
  25: "hero tier",
  50: "legendary",
};
const MIN_DONATION_AMOUNT = 5;
const MAX_DONATION_AMOUNT = 1000;

type Mode = "subscription" | "payment";

type Supporter = {
  id: string;
  name: string;
};

function parseAmount(rawAmount: string): number | null {
  const parsed = Number(rawAmount.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(amount: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits,
  }).format(amount);
}

type TopSupporter = {
  rank: number;
  name: string;
  totalMinor: number;
};

export default function SupportPageClient({
  isLoggedIn,
  stripeCustomerId,
  coveredMinor,
  targetMinor,
  topSupporters,
  subscriptionTierMinor,
  supporterRank,
  currentUserName,
}: {
  isLoggedIn: boolean;
  stripeCustomerId: string | null;
  coveredMinor: number;
  targetMinor: number | null;
  topSupporters: TopSupporter[];
  subscriptionTierMinor: number | null;
  supporterRank: number | null;
  currentUserName: string | null;
}) {
  const [mode, setMode] = useState<Mode>("subscription");
  const [selectedTier, setSelectedTier] = useState<number>(10);
  const [amount, setAmount] = useState("10");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [showGiveMore, setShowGiveMore] = useState(false);

  const isSubscriber = isLoggedIn && !!stripeCustomerId && subscriptionTierMinor !== null;

  const formattedOneTimePreview = useMemo(() => {
    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0) return null;
    return formatCurrency(parsed, 2);
  }, [amount]);

  // Minor units of the currently selected amount for the funding bar preview
  const previewMinor = useMemo(() => {
    if (!targetMinor) return 0;
    if (mode === "subscription") return selectedTier * 100;
    const parsed = parseAmount(amount);
    if (parsed === null || parsed < MIN_DONATION_AMOUNT) return 0;
    return Math.round(parsed * 100);
  }, [mode, selectedTier, amount, targetMinor]);

  // Percentage of monthly costs the selected amount covers
  const impactPct = useMemo(() => {
    if (!targetMinor) return null;
    if (mode === "subscription") return Math.round((selectedTier * 100 / targetMinor) * 100);
    const parsed = parseAmount(amount);
    if (!parsed || parsed < MIN_DONATION_AMOUNT) return null;
    return Math.round((parsed * 100 / targetMinor) * 100);
  }, [mode, selectedTier, amount, targetMinor]);

  useEffect(() => {
    let isMounted = true;

    async function loadSupporters() {
      try {
        const response = await fetch("/api/support/supporters", { cache: "no-store" });
        if (!response.ok) return;

        const data: { supporters?: Supporter[] } = await response.json();
        if (
          !isMounted ||
          !Array.isArray(data.supporters) ||
          !data.supporters.every(
            (s) => s && typeof s.id === "string" && typeof s.name === "string",
          )
        ) {
          return;
        }

        setSupporters(data.supporters);
      } catch {
        // Keep donation form usable even if supporter list fails
      }
    }

    loadSupporters();
    return () => { isMounted = false; };
  }, []);

  function handleModeSwitch(newMode: Mode) {
    setMode(newMode);
    setError(null);
    // Sync the amount field with the currently selected tier when switching
    if (newMode === "payment") {
      setAmount(String(selectedTier));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "subscription") {
        const response = await fetch("/api/support/checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "subscription", tierAmount: selectedTier }),
        });

        const data: { url?: string; error?: string } = await response.json();
        if (!response.ok || !data.url) {
          setError(data.error || "Could not start checkout. Please try again.");
          return;
        }

        window.location.assign(data.url);
        return;
      }

      // One-time payment
      const parsedAmount = parseAmount(amount);

      if (parsedAmount === null || parsedAmount <= 0) {
        setError("Please enter a valid amount.");
        return;
      }

      if (parsedAmount < MIN_DONATION_AMOUNT) {
        setError(`Minimum donation is ${formatCurrency(MIN_DONATION_AMOUNT)}.`);
        return;
      }

      if (parsedAmount > MAX_DONATION_AMOUNT) {
        setError(`Maximum donation is ${formatCurrency(MAX_DONATION_AMOUNT)}.`);
        return;
      }

      const response = await fetch("/api/support/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "payment", amount: parsedAmount }),
      });

      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error || "Could not start checkout. Please try again.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Network error while starting checkout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManageSubscription() {
    setIsOpeningPortal(true);
    setError(null);

    try {
      const response = await fetch("/api/support/portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: "/support" }),
      });

      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error || "Could not open billing portal. Please try again.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsOpeningPortal(false);
    }
  }

  const submitLabel = isSubmitting
    ? "Redirecting to Stripe..."
    : mode === "subscription"
      ? `Subscribe — ${formatCurrency(selectedTier)}/mo`
      : `Donate Once${formattedOneTimePreview ? ` — ${formattedOneTimePreview}` : ""}`;

  return (
    <div className="min-h-screen relative page-container pt-20 pb-20">
      <PageBackground />
      <main className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 mb-12 text-center lg:text-left">

          <p className="text-xs uppercase tracking-[0.2em] text-sky-400 font-bold mb-2">
            Community Powered
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Support CereBro
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
            Help keep hosting online and fund active development. Choose a monthly plan or make a one-time donation via Stripe Checkout.
          </p>
        </div>

        {targetMinor && (
          <FundingBar
            coveredMinor={coveredMinor}
            targetMinor={targetMinor}
            previewMinor={previewMinor}
          />
        )}

        <section className="max-w-6xl mx-auto px-4 lg:px-6 grid gap-8 lg:grid-cols-2">
          {/* Left: why support */}
          <div className="rounded-3xl border border-slate-800/60 bg-slate-900/50 p-8">
            <h2 className="text-2xl font-bold text-white mb-3">Why support?</h2>
            <p className="text-slate-300 mb-8">
              CereBro stays free for everyone. Donations help cover server costs,
              keep image processing reliable, and fund active development.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <Server className="w-5 h-5 text-sky-400 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Hosting and uptime</p>
                  <p className="text-sm text-slate-400">Reliable infrastructure for daily use.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Feature updates</p>
                  <p className="text-sm text-slate-400">New tools and ongoing improvements.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <Crown className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Supporter role on Discord</p>
                  <p className="text-sm text-slate-400">Get a special role on the CereBro server as a thank-you.</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              More perks for supporters are in the works — stay tuned.
            </p>

            {/* Leaderboard */}
            {topSupporters.length > 0 && (
              <div className="mt-8 border-t border-slate-800/70 pt-6">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-500 font-semibold mb-4">
                  All-time Top Supporters
                </p>
                <div className="space-y-2">
                  {topSupporters.map((s) => {
                    const rankStyles = [
                      { ring: "border-amber-400/40 bg-amber-400/10", label: "text-amber-300", bar: "from-amber-500 to-amber-300", track: "bg-amber-900/30", Icon: Crown },
                      { ring: "border-slate-400/30 bg-slate-400/8", label: "text-slate-300", bar: "from-slate-500 to-slate-300", track: "bg-slate-800/40", Icon: Trophy },
                      { ring: "border-orange-500/30 bg-orange-500/8", label: "text-orange-300", bar: "from-orange-600 to-orange-400", track: "bg-orange-900/30", Icon: Award },
                    ][s.rank - 1];

                    if (!rankStyles) return null;

                    const maxMinor = topSupporters[0].totalMinor;
                    const fillPct = Math.round((s.totalMinor / maxMinor) * 100);

                    return (
                      <div
                        key={s.rank}
                        className={`flex items-center gap-3 rounded-xl border ${rankStyles.ring} px-4 py-2.5`}
                      >
                        <rankStyles.Icon className={`w-4 h-4 shrink-0 ${rankStyles.label}`} />
                        <span className="flex-1 text-sm font-medium text-white truncate min-w-0">{s.name}</span>
                        {/* Relative mini-bar */}
                        <div className={`w-20 h-2 rounded-sm ${rankStyles.track} overflow-hidden shrink-0`}>
                          <div
                            className={`h-full rounded-sm bg-gradient-to-r ${rankStyles.bar} transition-all duration-500`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: subscriber thank-you card OR donation form */}
          {isSubscriber ? (
            <>
              <style>{`
                @keyframes btn-shimmer {
                  0%   { transform: translateX(-100%) skewX(-20deg); }
                  100% { transform: translateX(1400%) skewX(-20deg); }
                }
                @keyframes supporter-card-glow {
                  0%, 100% { box-shadow: 0 0 0 1px rgba(251,191,36,0.2), 0 0 20px rgba(251,191,36,0.05); }
                  50%       { box-shadow: 0 0 0 1px rgba(251,191,36,0.45), 0 0 32px rgba(251,191,36,0.12); }
                }
                @keyframes supporter-card-scan {
                  0%   { transform: translateX(-100%) skewX(-20deg); }
                  100% { transform: translateX(1400%) skewX(-20deg); }
                }
                @keyframes active-dot {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50%       { opacity: 0.5; transform: scale(0.8); }
                }
              `}</style>
              <div
                className="rounded-3xl border border-amber-500/25 bg-slate-900/60 p-8 backdrop-blur-sm relative overflow-hidden"
                style={{ animation: "supporter-card-glow 3s ease-in-out infinite" }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 via-slate-900/80 to-slate-900/90 rounded-3xl" />
                <div
                  className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-amber-200/5 to-transparent pointer-events-none"
                  style={{ animation: "supporter-card-scan 5s linear infinite" }}
                />

                <div className="relative space-y-5">
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold uppercase tracking-wider">
                      <Heart className="w-3 h-3 fill-amber-500/40" />
                      CereBro Supporter
                    </div>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        style={{ animation: "active-dot 2s ease-in-out infinite" }}
                      />
                      Active
                    </span>
                  </div>

                  {/* Heading */}
                  <div>
                    <h2 className="text-2xl font-bold text-amber-200">Thank you!</h2>
                    <p className="text-slate-400 mt-1 text-sm leading-relaxed">
                      Your support keeps CereBro running and actively developed.
                    </p>
                  </div>

                  {/* Tier */}
                  {subscriptionTierMinor !== null && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider">Monthly contribution</p>
                        <p className="text-amber-200 font-bold text-lg leading-tight">
                          {formatCurrency(subscriptionTierMinor / 100)}/month
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Leaderboard rank */}
                  {supporterRank !== null && (() => {
                    const rankInfo = [
                      { Icon: Crown, color: "text-amber-300", bg: "bg-amber-500/8 border-amber-500/20", label: "all-time #1 supporter" },
                      { Icon: Trophy, color: "text-slate-300", bg: "bg-slate-500/8 border-slate-500/20", label: "all-time #2 supporter" },
                      { Icon: Award, color: "text-orange-300", bg: "bg-orange-500/8 border-orange-500/20", label: "all-time #3 supporter" },
                    ][supporterRank - 1];
                    if (!rankInfo) return null;
                    return (
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${rankInfo.bg}`}>
                        <rankInfo.Icon className={`w-4 h-4 shrink-0 ${rankInfo.color}`} />
                        <p className={`text-sm font-semibold ${rankInfo.color}`}>
                          You&apos;re the {rankInfo.label}!
                        </p>
                      </div>
                    );
                  })()}

                  {/* Manage subscription */}
                  <button
                    type="button"
                    onClick={handleManageSubscription}
                    disabled={isOpeningPortal}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/15 text-amber-300 font-semibold py-3 transition-colors disabled:opacity-50"
                  >
                    <Settings className="w-4 h-4" />
                    {isOpeningPortal ? "Opening portal..." : "Manage Subscription"}
                  </button>

                  {/* Give more toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowGiveMore((v) => !v);
                      setMode("payment");
                      setError(null);
                    }}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showGiveMore ? "rotate-180" : ""}`} />
                    {showGiveMore ? "Hide" : "Want to give more? Make a one-time donation"}
                  </button>

                  {showGiveMore && (
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-800">
                      <p className="text-sm font-medium text-slate-300">Amount ({CURRENCY})</p>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_AMOUNTS.map((suggestedAmount) => {
                          const isActive = parseAmount(amount) === suggestedAmount;
                          const isCrazy = suggestedAmount === 100;
                          return (
                            <button
                              key={suggestedAmount}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => { setAmount(String(suggestedAmount)); setError(null); }}
                              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                                isCrazy
                                  ? isActive ? "bg-rose-500 text-white ring-1 ring-rose-400/50" : "bg-slate-800 text-rose-300 border border-rose-500/30 hover:bg-rose-900/40 hover:text-rose-200"
                                  : isActive ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                              }`}
                            >
                              {formatCurrency(suggestedAmount)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-4 focus-within:ring-2 focus-within:ring-sky-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 transition-shadow">
                        <span className="text-slate-400 mr-2">{CURRENCY}</span>
                        <input
                          id="donation-amount-extra"
                          name="amount"
                          inputMode="decimal"
                          autoComplete="off"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="10"
                          className="w-full bg-transparent py-3 text-white border-0 focus:outline-none"
                        />
                      </div>
                      {formattedOneTimePreview ? (
                        <p className="text-sm text-slate-400">
                          You are about to donate{" "}
                          <span className="text-white font-medium">{formattedOneTimePreview}</span>
                          {parseAmount(amount) === 100 && <span className="text-rose-400"> — are you crazy?!</span>}
                        </p>
                      ) : (
                        <p className="text-sm text-amber-400">Please enter a valid amount.</p>
                      )}
                      {impactPct !== null && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/8 border border-sky-500/15 text-xs text-sky-300 w-fit">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>Covers ~<span className="font-bold">{impactPct}%</span> of monthly costs</span>
                        </div>
                      )}
                      {error && <p className="text-sm text-red-400">{error}</p>}
                      <button
                        type="submit"
                        disabled={isSubmitting || !formattedOneTimePreview}
                        className="w-full rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/60 disabled:cursor-not-allowed text-white font-semibold py-3 transition-colors"
                      >
                        {isSubmitting ? "Redirecting to Stripe..." : `Donate Once${formattedOneTimePreview ? ` — ${formattedOneTimePreview}` : ""}`}
                      </button>
                      <p className="text-xs text-slate-500">
                        You will be redirected to Stripe Checkout.
                      </p>
                    </form>
                  )}

                  {/* Supporters list */}
                  {supporters.length > 0 && (
                    <div className="border-t border-slate-800/70 pt-5">
                      <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                        {supporters.length} recent supporter{supporters.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {supporters.map((supporter, idx) => (
                          <span
                            key={`${supporter.id}-${idx}`}
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              currentUserName && supporter.name === currentUserName
                                ? "bg-amber-500/20 border border-amber-500/40 text-amber-200"
                                : "bg-slate-800/80 border border-slate-700 text-slate-200"
                            }`}
                          >
                            {supporter.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-sky-500/30 bg-slate-900/60 p-8 backdrop-blur-sm">
              {/* Mode toggle */}
              <div className="flex rounded-xl bg-slate-950/60 border border-slate-800 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => handleModeSwitch("subscription")}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    mode === "subscription"
                      ? "bg-sky-500 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch("payment")}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    mode === "payment"
                      ? "bg-slate-700 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  One-time
                </button>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold uppercase tracking-wider mb-5">
                <Heart className="w-3 h-3 fill-sky-500/40" />
                {mode === "subscription" ? "Monthly Subscription" : "One-time Donation"}
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {mode === "subscription" ? "Choose your plan" : "Choose your amount"}
              </h2>

              {!isLoggedIn && (
                <div className="mb-6 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-200 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Info className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-300 mb-1">Not signed in</p>
                      <p className="text-amber-200/80 leading-relaxed mb-3">
                        To receive the <strong>Supporter role</strong> on our Discord server, please sign in before donating. You can still donate without signing in.
                      </p>
                      <form action={signInAction}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Sign in with Discord
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "subscription" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SUBSCRIPTION_TIERS.map((tier) => {
                        const isActive = selectedTier === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            aria-pressed={isActive}
                            aria-label={`${formatCurrency(tier)} per month`}
                            onClick={() => { setSelectedTier(tier); setError(null); }}
                            className={`rounded-xl px-3 py-2.5 flex flex-col items-center gap-0.5 transition-colors ${
                              isActive
                                ? "bg-sky-500 text-white"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            <span className="text-sm font-semibold">{formatCurrency(tier)}/mo</span>
                            <span className={`text-[11px] leading-tight ${isActive ? "text-sky-100/80" : "text-slate-500"}`}>
                              {TIER_TAGLINES[tier]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-sm text-slate-400">
                      You will be billed{" "}
                      <span className="text-white font-medium">{formatCurrency(selectedTier)}/month</span>.
                      Cancel anytime from your account.
                    </p>
                  </>
                ) : (
                  <>
                    <label htmlFor="donation-amount" className="block text-sm text-slate-300 font-medium">
                      Amount ({CURRENCY})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_AMOUNTS.map((suggestedAmount) => {
                        const isActive = parseAmount(amount) === suggestedAmount;
                        const isCrazy = suggestedAmount === 100;
                        return (
                          <button
                            key={suggestedAmount}
                            type="button"
                            aria-pressed={isActive}
                            aria-label={`Donate ${formatCurrency(suggestedAmount)}`}
                            onClick={() => { setAmount(String(suggestedAmount)); setError(null); }}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                              isCrazy
                                ? isActive
                                  ? "bg-rose-500 text-white ring-1 ring-rose-400/50"
                                  : "bg-slate-800 text-rose-300 border border-rose-500/30 hover:bg-rose-900/40 hover:text-rose-200"
                                : isActive
                                  ? "bg-sky-500 text-white"
                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            {formatCurrency(suggestedAmount)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-4 focus-within:ring-2 focus-within:ring-sky-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 transition-shadow">
                      <span className="text-slate-400 mr-2">{CURRENCY}</span>
                      <input
                        id="donation-amount"
                        name="amount"
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="10"
                        className="w-full bg-transparent py-3 text-white border-0 focus:outline-none"
                      />
                    </div>
                    {formattedOneTimePreview ? (
                      <p className="text-sm text-slate-400">
                        You are about to donate{" "}
                        <span className="text-white font-medium">{formattedOneTimePreview}</span>
                        {parseAmount(amount) === 100 && (
                          <span className="text-rose-400"> — are you crazy?!</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-400">Please enter a valid amount.</p>
                    )}
                  </>
                )}

                {impactPct !== null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/8 border border-sky-500/15 text-xs text-sky-300 w-fit">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>
                      Covers ~<span className="font-bold">{impactPct}%</span> of monthly costs
                      {mode === "subscription" ? " every month" : ""}
                    </span>
                  </div>
                )}

                {error ? <p className="text-sm text-red-400">{error}</p> : null}

                <button
                  type="submit"
                  disabled={isSubmitting || (mode === "payment" && !formattedOneTimePreview)}
                  className={[
                    "relative w-full overflow-hidden rounded-xl py-3.5 px-5",
                    "flex items-center justify-center gap-2.5",
                    "font-semibold text-white text-sm [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    mode === "subscription"
                      ? "bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-700 hover:from-sky-600 hover:via-sky-500 hover:to-cyan-600 shadow-[0_0_18px_rgba(14,165,233,0.35)] hover:shadow-[0_0_24px_rgba(14,165,233,0.5)]"
                      : "bg-gradient-to-r from-amber-700 via-amber-600 to-orange-600 hover:from-amber-600 hover:via-amber-500 hover:to-orange-500 shadow-[0_0_18px_rgba(245,158,11,0.3)] hover:shadow-[0_0_24px_rgba(245,158,11,0.45)]",
                  ].join(" ")}
                >
                  {/* shimmer sweep */}
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    style={{ animation: "btn-shimmer 2.4s linear infinite" }}
                  />
                  {isSubmitting
                    ? <span className="flex items-center gap-2"><Lock className="w-4 h-4 opacity-70" /> Redirecting to Stripe…</span>
                    : <>
                        {mode === "subscription" ? <Heart className="w-4 h-4 shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" />}
                        <span>{submitLabel}</span>
                        <ArrowRight className="w-4 h-4 shrink-0 ml-auto opacity-60" />
                      </>
                  }
                </button>
              </form>

              <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
                <Lock className="w-3 h-3 shrink-0" />
                <span>
                  Redirects to Stripe Checkout. Need context first?{" "}
                  <Link href="/about" className="text-slate-300 hover:text-white underline underline-offset-4">
                    Read about CereBro
                  </Link>
                  .
                </span>
              </p>

              {isLoggedIn && stripeCustomerId && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleManageSubscription}
                    disabled={isOpeningPortal}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {isOpeningPortal ? "Opening portal..." : "Manage your subscription"}
                  </button>
                </div>
              )}

              {supporters.length > 0 ? (
                <div className="mt-7 border-t border-slate-800/70 pt-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                    {supporters.length} recent supporter{supporters.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {supporters.map((supporter, idx) => (
                      <span
                        key={`${supporter.id}-${idx}`}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          currentUserName && supporter.name === currentUserName
                            ? "bg-amber-500/20 border border-amber-500/40 text-amber-200"
                            : "bg-slate-800/80 border border-slate-700 text-slate-200"
                        }`}
                      >
                        {supporter.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
