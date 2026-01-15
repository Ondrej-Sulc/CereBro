import { Suspense } from "react";
import CommandReference from "@/components/CommandReference";
import PageBackground from "@/components/PageBackground";
import { isUserBotAdmin } from "@/lib/auth-helpers";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Commands - CereBro",
  description: "Comprehensive list of slash commands available in the CereBro Discord bot.",
};

export default async function CommandsPage() {
  const isAdmin = await isUserBotAdmin();

  return (
    <div className="min-h-screen relative page-container pt-20 pb-20">
      <PageBackground />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-10 text-center lg:text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-400 font-bold mb-2">
                Documentation
            </p>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                Command Reference
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
                A complete list of slash commands to help you manage your alliance, query champion info, and plan your wars.
            </p>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-indigo-500/50 via-sky-500/50 to-transparent mb-10" />

        <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-500 animate-pulse">Loading commands...</div>}>
            <CommandReference isAdmin={isAdmin} />
        </Suspense>
      </main>
    </div>
  );
}
