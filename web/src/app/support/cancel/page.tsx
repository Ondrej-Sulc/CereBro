import Link from "next/link";
import { RotateCcw } from "lucide-react";
import PageBackground from "@/components/PageBackground";

export const metadata = {
  title: "Cancel Support - CereBro",
  description: "No charge was made. Return anytime to try supporting CereBro again.",
};

export default function SupportCancelPage() {
  return (
    <div className="min-h-screen relative page-container pt-20 pb-20">
      <PageBackground />
      <main className="relative z-10">
        <section className="max-w-3xl mx-auto px-4 lg:px-6">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-8 md:p-10 text-center">
            <RotateCcw aria-hidden="true" className="w-12 h-12 text-slate-300 mx-auto mb-5" />
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Donation cancelled
            </h1>
            <p className="text-slate-300 text-lg max-w-xl mx-auto mb-8">
              No charge was made. You can return to support anytime and try
              again with a custom amount.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/support"
                className="inline-flex items-center justify-center rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-medium px-6 py-3 transition-colors"
              >
                Try Again
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 transition-colors"
              >
                Back to About
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
