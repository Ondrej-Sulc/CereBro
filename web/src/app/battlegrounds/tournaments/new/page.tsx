import type { Metadata } from "next";
import { ArrowLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { TournamentCreateForm } from "../tournament-create-form";

export const metadata: Metadata = {
  title: "Create Battlegrounds Tournament - CereBro",
  description: "Create a Battlegrounds tournament draft.",
};

export const dynamic = "force-dynamic";

export default async function CreateBattlegroundsTournamentPage() {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-10 text-center">
          <Trophy className="mx-auto h-12 w-12 text-slate-700" />
          <h1 className="mt-4 text-2xl font-bold text-white">Login Required</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Sign in with Discord and select a CereBro profile to create Battlegrounds tournaments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)]">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button asChild variant="ghost" className="-ml-3 mb-4 text-slate-400 hover:bg-slate-900 hover:text-slate-100">
              <Link href="/battlegrounds/tournaments">
                <ArrowLeft className="h-4 w-4" />
                Back to tournaments
              </Link>
            </Button>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
              <Trophy className="h-3.5 w-3.5" />
              Battlegrounds
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Create Tournament
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Configure the draft before opening registration.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Alliance</p>
            <p className="font-semibold text-slate-200">{player.alliance?.name ?? "No alliance"}</p>
          </div>
        </div>

        <TournamentCreateForm
          allianceName={player.alliance?.name ?? "No alliance"}
          hasAlliance={!!player.allianceId}
        />
      </div>
    </div>
  );
}
