import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Heart, RefreshCw, BarChart2, ExternalLink } from "lucide-react";
import PageBackground from "@/components/PageBackground";
import { DISCORD_INVITE } from "@/lib/links";
import { prisma } from "@/lib/prisma";

function formatEur(minor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

async function fetchDonationInfo(session_id?: string | string[]): Promise<{
  status: string | null;
  isSubscription: boolean;
  amountMinor: number | null;
}> {
  const normalizedSessionId = Array.isArray(session_id) ? session_id[0] : session_id;
  if (!normalizedSessionId) return { status: null, isSubscription: false, amountMinor: null };

  try {
    const donation = await prisma.supportDonation.findUnique({
      where: { stripeCheckoutSessionId: normalizedSessionId },
      select: { status: true, stripeSubscriptionId: true, amountMinor: true },
    });
    return {
      status: donation?.status ?? null,
      isSubscription: !!donation?.stripeSubscriptionId,
      amountMinor: donation?.amountMinor ?? null,
    };
  } catch (error) {
    console.error("Donation status verification failed:", error);
    return { status: null, isSubscription: false, amountMinor: null };
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}): Promise<Metadata> {
  const { session_id } = await searchParams;
  const { status } = await fetchDonationInfo(session_id);

  if (status === "succeeded") {
    return {
      title: "Support Successful - CereBro",
      description: "Thank you for supporting CereBro and helping fund hosting and active development.",
    };
  }

  return {
    title: "Support Status - CereBro",
    description: "Verifying your support status.",
  };
}

export default async function SupportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const { session_id } = await searchParams;
  const { status, isSubscription, amountMinor } = await fetchDonationInfo(session_id);
  const isSuccess = status === "succeeded";

  if (!isSuccess) {
    return (
      <div className="min-h-screen relative page-container pt-20 pb-20">
        <PageBackground />
        <main className="relative z-10">
          <section className="max-w-3xl mx-auto px-4 lg:px-6">
            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/60 p-8 md:p-10 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                Support Status
              </h1>
              <p className="text-slate-300 text-lg max-w-xl mx-auto mb-3">
                We couldn&apos;t verify your session yet. If you completed a payment, Stripe webhooks can
                take a moment to arrive — your contribution will show up shortly.
              </p>
              <p className="text-slate-500 text-sm max-w-xl mx-auto mb-8">
                Check the support page to see if the funding bar has updated.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 justify-center rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-3 transition-colors"
                >
                  <BarChart2 className="w-4 h-4" />
                  View Funding Bar
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const amountLabel = amountMinor ? formatEur(amountMinor) : null;

  return (
    <div className="min-h-screen relative page-container pt-20 pb-20">
      <PageBackground />
      <main className="relative z-10">
        <section className="max-w-3xl mx-auto px-4 lg:px-6">
          <style>{`
            @keyframes success-glow {
              0%, 100% { box-shadow: 0 0 0 1px rgba(52,211,153,0.25), 0 0 24px rgba(52,211,153,0.06); }
              50%       { box-shadow: 0 0 0 1px rgba(52,211,153,0.5),  0 0 40px rgba(52,211,153,0.14); }
            }
            @keyframes success-scan {
              0%   { transform: translateX(-100%) skewX(-20deg); }
              100% { transform: translateX(1400%) skewX(-20deg); }
            }
            @keyframes check-pop {
              0%   { transform: scale(0.6); opacity: 0; }
              70%  { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>

          <div
            className="rounded-3xl border border-emerald-500/30 bg-slate-900/60 p-8 md:p-10 text-center relative overflow-hidden"
            style={{ animation: "success-glow 3s ease-in-out infinite" }}
          >
            {/* BG layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-900/90 rounded-3xl" />
            <div
              className="absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-emerald-200/5 to-transparent pointer-events-none"
              style={{ animation: "success-scan 5s linear infinite" }}
            />

            <div className="relative">
              <CheckCircle2
                aria-hidden="true"
                className="w-14 h-14 text-emerald-400 mx-auto mb-5"
                style={{ animation: "check-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}
              />

              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
                Thank you for supporting CereBro!
              </h1>

              {/* Amount + type callout */}
              {amountLabel && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 text-emerald-300 font-semibold text-sm mb-5">
                  <Heart aria-hidden="true" className="w-3.5 h-3.5 fill-emerald-500/40" />
                  {isSubscription
                    ? `${amountLabel}/month — active subscription`
                    : `${amountLabel} one-time donation`}
                </div>
              )}

              <p className="text-slate-300 text-base max-w-xl mx-auto mb-2">
                {isSubscription
                  ? "Your monthly support keeps hosting online and funds active development for the entire community."
                  : "Your donation helps keep hosting online and funds active development for the entire community."}
              </p>

              <p className="text-emerald-400/80 text-sm mb-6">
                Your contribution is already reflected in the funding bar.
              </p>

              {/* Primary CTA */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-7 py-3 transition-colors"
                >
                  <BarChart2 className="w-4 h-4" />
                  See the Funding Bar
                </Link>
                {isSubscription && (
                  <Link
                    href="/profile"
                    className="inline-flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 transition-colors"
                  >
                    My Profile
                  </Link>
                )}
              </div>

              {/* Secondary: Discord */}
              <div className="border-t border-slate-800/70 pt-5">
                <p className="text-slate-500 text-xs mb-3 uppercase tracking-wider">Join the community</p>
                <Link
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join Community Discord (opens in a new tab)"
                  className="inline-flex items-center gap-2 justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/8 hover:bg-indigo-500/15 text-indigo-300 font-medium px-5 py-2.5 text-sm transition-colors"
                >
                  Join Community Discord
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </Link>
                {isSubscription && (
                  <p className="text-slate-600 text-xs mt-2">
                    Your Supporter role should appear shortly after joining.
                  </p>
                )}
              </div>

              {/* Billing footnote for subscriptions */}
              {isSubscription && (
                <div className="mt-5 inline-flex items-center gap-1.5 text-slate-600 text-xs">
                  <RefreshCw aria-hidden="true" className="w-3 h-3" />
                  Billed monthly. Cancel anytime from your profile.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
