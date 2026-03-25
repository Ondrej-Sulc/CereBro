"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, ShieldCheck, Server, Sparkles, Info, LogIn, Settings } from "lucide-react";
import PageBackground from "@/components/PageBackground";
import { signInAction } from "@/app/actions/auth";

const CURRENCY = "EUR";
const SUBSCRIPTION_TIERS = [5, 10, 25, 50] as const;
const SUGGESTED_AMOUNTS = [5, 10, 25, 50];
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

export default function SupportPageClient({
  isLoggedIn,
  stripeCustomerId,
}: {
  isLoggedIn: boolean;
  stripeCustomerId: string | null;
}) {
  const [mode, setMode] = useState<Mode>("subscription");
  const [selectedTier, setSelectedTier] = useState<number>(10);
  const [amount, setAmount] = useState("10");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supporters, setSupporters] = useState<Supporter[]>([]);

  const formattedOneTimePreview = useMemo(() => {
    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0) return null;
    return formatCurrency(parsed, 2);
  }, [amount]);

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
                <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Secure checkout</p>
                  <p className="text-sm text-slate-400">Payments are handled on Stripe-hosted pages.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: donation form */}
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
                  <div className="flex flex-wrap gap-2">
                    {SUBSCRIPTION_TIERS.map((tier) => {
                      const isActive = selectedTier === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          aria-pressed={isActive}
                          aria-label={`${formatCurrency(tier)} per month`}
                          onClick={() => { setSelectedTier(tier); setError(null); }}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-sky-500 text-white"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                          }`}
                        >
                          {formatCurrency(tier)}/mo
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
                      return (
                        <button
                          key={suggestedAmount}
                          type="button"
                          aria-pressed={isActive}
                          aria-label={`Donate ${formatCurrency(suggestedAmount)}`}
                          onClick={() => { setAmount(String(suggestedAmount)); setError(null); }}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                            isActive
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
                      <span className="text-white font-medium">{formattedOneTimePreview}</span>.
                    </p>
                  ) : (
                    <p className="text-sm text-amber-400">Please enter a valid amount.</p>
                  )}
                </>
              )}

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting || (mode === "payment" && !formattedOneTimePreview)}
                className="w-full rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/60 disabled:cursor-not-allowed text-white font-semibold py-3 transition-colors"
              >
                {submitLabel}
              </button>
            </form>

            <p className="text-xs text-slate-500 mt-5">
              By continuing, you will be redirected to Stripe Checkout. Need context first?{" "}
              <Link href="/about" className="text-slate-300 hover:text-white underline underline-offset-4">
                Read about CereBro
              </Link>
              .
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
                  Recent Supporters
                </p>
                <div className="flex flex-wrap gap-2">
                  {supporters.map((supporter, idx) => (
                    <span
                      key={`${supporter.id}-${idx}`}
                      className="rounded-full bg-slate-800/80 border border-slate-700 px-3 py-1 text-xs text-slate-200"
                    >
                      {supporter.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
