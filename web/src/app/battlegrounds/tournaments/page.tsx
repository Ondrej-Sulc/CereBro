import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Compass, Crown, Plus, Swords, Trophy, Users } from "lucide-react";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { formatLabels, participantLabels, scopeLabels, statusLabels } from "./tournament-labels";

export const metadata: Metadata = {
  title: "Battlegrounds Tournaments - CereBro",
  description: "Create, organize, and manage alliance Battlegrounds tournaments.",
};

export const dynamic = "force-dynamic";

function formatTournamentDate(date: Date | null) {
  if (!date) return "Start TBD";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "REGISTRATION":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
    case "CHECK_IN":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "LIVE":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "COMPLETED":
      return "border-slate-700 bg-slate-900 text-slate-300";
    case "CANCELLED":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

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
      participants: {
        select: {
          playerId: true,
          status: true,
        },
      },
      _count: { select: { participants: true, matches: true } },
    },
    orderBy: [
      { status: "asc" },
      { startsAt: "asc" },
      { createdAt: "desc" },
    ],
  });

  const myTournaments = tournaments.filter((tournament) => (
    tournament.createdById === player.id ||
    tournament.participants.some((participant) => participant.playerId === player.id)
  ));
  const myTournamentIds = new Set(myTournaments.map((tournament) => tournament.id));
  const discoveryTournaments = tournaments.filter((tournament) => !myTournamentIds.has(tournament.id));
  const createdTournamentCount = myTournaments.filter((tournament) => tournament.createdById === player.id).length;
  const activeTournamentCount = myTournaments.filter((tournament) => ["REGISTRATION", "CHECK_IN", "LIVE"].includes(tournament.status)).length;

  const renderTournamentCard = (tournament: (typeof tournaments)[number], variant: "personal" | "discover") => {
    const participant = tournament.participants.find((entry) => entry.playerId === player.id);
    const isCreator = tournament.createdById === player.id;
    const relationLabel = isCreator
      ? "Organizer"
      : participant
        ? participantLabels[participant.status]
        : "Discover";
    const relationTone = isCreator
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : participant
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : "border-slate-700 bg-slate-900 text-slate-300";

    return (
      <Link
        key={tournament.id}
        href={`/battlegrounds/tournaments/${tournament.id}`}
        className="group rounded-lg border border-slate-800 bg-slate-950/70 p-4 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {isCreator && <Crown className="h-4 w-4 shrink-0 text-amber-300" />}
              <h2 className="truncate text-lg font-bold text-white group-hover:text-cyan-100">{tournament.name}</h2>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">
              {formatLabels[tournament.format]} by {tournament.createdBy.ingameName}
            </p>
          </div>
          <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${statusBadgeClass(tournament.status)}`}>
            {statusLabels[tournament.status]}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-semibold ${relationTone}`}>
            {relationLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatTournamentDate(tournament.startsAt)}
          </span>
          <span className="rounded border border-slate-800 bg-slate-900 px-2 py-1">
            {scopeLabels[tournament.scope]}{tournament.alliance?.name ? ` · ${tournament.alliance.name}` : ""}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1">
            <Users className="h-3.5 w-3.5" />
            {tournament._count.participants} summoners
          </span>
        </div>

        {variant === "personal" && tournament._count.matches > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Swords className="h-3.5 w-3.5" />
            {tournament._count.matches} fights scheduled
          </div>
        )}
      </Link>
    );
  };

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
              Your Battlegrounds Tournaments
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Jump back into events you are running or fighting in, then discover open alliance and community tournaments.
            </p>
          </div>
          <Button asChild className="w-fit bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            <Link href="/battlegrounds/tournaments/new">
              <Plus className="h-4 w-4" />
              Create tournament
            </Link>
          </Button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">My tournaments</p>
            <p className="mt-2 text-2xl font-black text-white">{myTournaments.length}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Organizing</p>
            <p className="mt-2 text-2xl font-black text-white">{createdTournamentCount}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Active now</p>
            <p className="mt-2 text-2xl font-black text-white">{activeTournamentCount}</p>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-cyan-300" />
                <h2 className="text-xl font-black text-white">My Tournaments</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">Events you created or joined appear first.</p>
            </div>
          </div>

          {myTournaments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-8">
              <h3 className="text-lg font-bold text-white">No personal tournaments yet</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Join an available event below or create one for your alliance so it shows up here next time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {myTournaments.map((tournament) => renderTournamentCard(tournament, "personal"))}
            </div>
          )}
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-300" />
                <h2 className="text-xl font-black text-white">Discover</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">Alliance and community tournaments you are not part of yet.</p>
            </div>
          </div>

          {discoveryTournaments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-8 text-sm text-slate-500">
              No additional tournaments are available for discovery right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {discoveryTournaments.map((tournament) => renderTournamentCard(tournament, "discover"))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
