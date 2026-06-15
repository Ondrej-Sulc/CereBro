import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Swords, Trophy, Users } from "lucide-react";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { formatLabels, scopeLabels, statusLabels } from "./tournament-labels";

export const metadata: Metadata = {
  title: "Battlegrounds Tournaments - CereBro",
  description: "Create, organize, and manage alliance Battlegrounds tournaments.",
};

export const dynamic = "force-dynamic";

export default async function BattlegroundsTournamentsPage() {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-10 text-center">
          <Trophy className="mx-auto h-12 w-12 text-slate-700" />
          <h1 className="mt-4 text-2xl font-bold text-white">Login Required</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Sign in with Discord and select a CereBro profile to join or host Battlegrounds tournaments.
          </p>
        </div>
      </div>
    );
  }

  logger.info(
    { userId: player.id, allianceId: player.allianceId },
    "User accessing Battlegrounds Tournaments page"
  );

  const tournaments = await prisma.battlegroundsTournament.findMany({
    where: {
      OR: [
        { scope: "COMMUNITY" },
        ...(player.allianceId ? [{ allianceId: player.allianceId }] : []),
        { createdById: player.id },
      ],
    },
    include: {
      createdBy: { select: { ingameName: true } },
      alliance: { select: { name: true } },
      _count: { select: { participants: true, matches: true } },
    },
    orderBy: [
      { status: "asc" },
      { startsAt: "asc" },
      { createdAt: "desc" },
    ],
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)]">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
              <Swords className="h-3.5 w-3.5" />
              Battlegrounds
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Tournament Control
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Build the field, stage registration, manage check-ins, and keep alliance context visible while your BG event comes together.
            </p>
          </div>
          <Button asChild className="w-fit bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            <Link href="/battlegrounds/tournaments/new">
              <Plus className="h-4 w-4" />
              Create tournament
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-10 text-center">
            <Trophy className="mx-auto h-12 w-12 text-slate-700" />
            <h2 className="mt-4 text-xl font-bold text-white">No tournaments yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Create a Battlegrounds tournament to start building the field.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/battlegrounds/tournaments/${tournament.id}`}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-white">{tournament.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatLabels[tournament.format]} by {tournament.createdBy.ingameName}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300">
                    {statusLabels[tournament.status]}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded border border-slate-800 bg-slate-900 px-2 py-1">{scopeLabels[tournament.scope]}</span>
                  <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1">
                    <Users className="h-3.5 w-3.5" />
                    {tournament._count.participants} summoners
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1">
                    <Swords className="h-3.5 w-3.5" />
                    {tournament._count.matches} fights
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
