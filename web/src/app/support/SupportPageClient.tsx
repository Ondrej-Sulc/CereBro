"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, ShieldCheck, Server, Sparkles, Info, LogIn } from "lucide-react";
import PageBackground from "@/components/PageBackground";
import { signInAction } from "@/app/actions/auth";

const CURRENCY = "EUR";
const SUGGESTED_AMOUNTS = [5, 10, 25, 50];
const MIN_DONATION_AMOUNT = 0.5;
const MAX_DONATION_AMOUNT = 1000;

type Supporter = {
  id: string;
  name: string;
};

function parseAmount(rawAmount: string): number | null {
  const parsed = Number(rawAmount.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function SupportPageClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [amount, setAmount] = useState("10");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supporters, setSupporters] = useState<Supporter[]>([]);

  const formattedPreview = useMemo(() => {
    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0) {
      return null;
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: CURRENCY,
    }).format(parsed);
  }, [amount]);

  useEffect(() => {
    let isMounted = true;

    async function loadSupporters() {
      try {
        const response = await fetch("/api/support/supporters", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data: { supporters?: Supporter[] } = await response.json();
        if (
          !isMounted ||
          !Array.isArray(data.supporters) ||
          !data.supporters.every(
            (supporter) =>
              supporter &&
              typeof supporter.id === "string" &&
              typeof supporter.name === "string",
          )
        ) {
          return;
        }

        setSupporters(data.supporters);
      } catch {
        // Ignore supporter list failures to keep donation form usable.
      }
    }

    loadSupporters();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const parsedAmount = parseAmount(amount);

    if (parsedAmount === null || parsedAmount <= 0) {
      setError("Please enter a valid amount.");
      setIsSubmitting(false);
      return;
    }

    if (parsedAmount < MIN_DONATION_AMOUNT || parsedAmount > MAX_DONATION_AMOUNT) {
      setError("Please enter an amount between EUR 0.50 and EUR 1,000.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/support/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: parsedAmount }),
      });

      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error || "Could not start checkout. Please try again.");
        setIsSubmitting(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Network error while starting checkout. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative page-container pt-20 pb-20">
      <PageBackground />
      <main className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 mb-12 text-center lg:text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-pink-400 font-bold mb-2">
            Community Powered
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Support CereBro
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
            Enter any amount and complete your donation via Stripe Checkout.
            Available payment methods depend on your device and region.
          </p>
        </div>

        <section className="max-w-6xl mx-auto px-4 lg:px-6 grid gap-8 lg:grid-cols-2">
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

          <div className="rounded-3xl border border-pink-500/30 bg-slate-900/60 p-8 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold uppercase tracking-wider mb-5">
              <Heart className="w-3 h-3 fill-pink-500/40" />
              Donation
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Choose your amount</h2>
            <p className="text-slate-300 mb-6">
              Any custom amount is supported.
            </p>

            {!isLoggedIn && (
              <div className="mb-8 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-200 text-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Info className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-300 mb-1">Not signed in</p>
                    <p className="text-amber-200/80 leading-relaxed mb-3">
                      To receive the <strong>Supporter role</strong> on our Discord server, please sign in before donating. You can still donate without signing in, but we won&apos;t be able to link it to your Discord account automatically.
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
              <label htmlFor="donation-amount" className="block text-sm text-slate-300 font-medium">
                Amount ({CURRENCY})
              </label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_AMOUNTS.map((suggestedAmount) => {
                  const isActive = parseAmount(amount) === suggestedAmount;
                  const formattedAmount = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: CURRENCY,
                    maximumFractionDigits: 0,
                  }).format(suggestedAmount);
                  return (
                    <button
                      key={suggestedAmount}
                      type="button"
                      aria-pressed={isActive}
                      aria-label={`Donate ${formattedAmount}`}
                      onClick={() => {
                        setAmount(String(suggestedAmount));
                        setError(null);
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-pink-500 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {formattedAmount}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-4 focus-within:ring-2 focus-within:ring-pink-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 transition-shadow">
                <span className="text-slate-400 mr-2">{CURRENCY}</span>
                <input
                  id="donation-amount"
                  name="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="10"
                  className="w-full bg-transparent py-3 text-white border-0 focus:outline-none"
                />
              </div>

              {formattedPreview ? (
                <p className="text-sm text-slate-400">
                  You are about to donate <span className="text-white font-medium">{formattedPreview}</span>.
                </p>
              ) : (
                <p className="text-sm text-amber-400">Please enter a valid amount.</p>
              )}

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/60 disabled:cursor-not-allowed text-white font-semibold py-3 transition-colors"
              >
                {isSubmitting ? "Redirecting to Stripe..." : "Support CereBro"}
              </button>
            </form>

            <p className="text-xs text-slate-500 mt-5">
              By continuing, you will be redirected to Stripe Checkout. Need context first?{" "}
              <Link href="/about" className="text-slate-300 hover:text-white underline underline-offset-4">
                Read about CereBro
              </Link>
              .
            </p>

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
