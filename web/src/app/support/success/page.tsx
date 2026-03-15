import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Heart } from "lucide-react";
import PageBackground from "@/components/PageBackground";
import { DISCORD_INVITE } from "@/lib/links";
import { prisma } from "@/lib/prisma";

async function fetchDonationStatus(session_id?: string | string[]): Promise<string | null> {
  const normalizedSessionId = Array.isArray(session_id) ? session_id[0] : session_id;
  if (!normalizedSessionId) return null;

  try {
    const donation = await prisma.supportDonation.findUnique({
      where: { stripeCheckoutSessionId: normalizedSessionId },
      select: { status: true }
    });
    return donation?.status || null;
  } catch (error) {
    console.error("Donation status verification failed:", error);
    return null;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}): Promise<Metadata> {
  const { session_id } = await searchParams;
  const status = await fetchDonationStatus(session_id);
  
  if (status === 'succeeded') {
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
  const status = await fetchDonationStatus(session_id);
  const isSuccess = status === 'succeeded';

  if (!isSuccess) {
    return (
      <div className="min-h-screen relative page-container pt-20 pb-20">
        <PageBackground />
        <main className="relative z-10">
          <section className="max-w-3xl mx-auto px-4 lg:px-6">
            <div className="rounded-3xl border border-slate-500/30 bg-slate-900/60 p-8 md:p-10 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                Support Status
              </h1>
              <p className="text-slate-300 text-lg max-w-xl mx-auto mb-8">
                We could not verify your support session. If you completed a payment, it may take a few moments to process.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
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

  return (
    <div className="min-h-screen relative page-container pt-20 pb-20">
      <PageBackground />
      <main className="relative z-10">
        <section className="max-w-3xl mx-auto px-4 lg:px-6">
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/60 p-8 md:p-10 text-center">
            <CheckCircle2
              aria-hidden="true"
              className="w-14 h-14 text-emerald-400 mx-auto mb-5"
            />
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Thank you for supporting CereBro
            </h1>
            <p className="text-slate-300 text-lg max-w-xl mx-auto mb-8">
              Your donation helps keep hosting online and funds active development
              for the entire community.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 transition-colors"
              >
                Back to Home
              </Link>
              <Link
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join Community Discord (opens in a new tab)"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-6 py-3 transition-colors"
              >
                Join Community Discord
                <span className="sr-only">(opens in a new tab)</span>
              </Link>
            </div>

            <div className="mt-8 inline-flex items-center gap-2 text-pink-300/90 text-sm">
              <Heart aria-hidden="true" className="w-4 h-4 fill-pink-500/40" />
              Community powered, always.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
