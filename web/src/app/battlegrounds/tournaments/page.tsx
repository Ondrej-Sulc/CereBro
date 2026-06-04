import type { Metadata } from "next";
import { Swords, Trophy } from "lucide-react";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { canPlanAllianceWar } from "@/lib/alliance-permissions";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { BattlegroundsTournamentsClient } from "./tournaments-client";

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

  const [members, tournaments] = await Promise.all([
    prisma.player.findMany({
      where: player.allianceId
        ? {
            OR: [
              { allianceId: player.allianceId },
              { allianceId: null },
            ],
          }
        : { allianceId: null },
      select: {
        id: true,
        ingameName: true,
        battlegroup: true,
        championPrestige: true,
        avatar: true,
      },
      orderBy: [
        { battlegroup: "asc" },
        { ingameName: "asc" },
      ],
    }),
    prisma.battlegroundsTournament.findMany({
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
          include: {
            player: {
              select: {
                id: true,
                ingameName: true,
                battlegroup: true,
                championPrestige: true,
                avatar: true,
              },
            },
          },
          orderBy: [
            { seed: "asc" },
            { createdAt: "asc" },
          ],
        },
        matches: {
          include: {
            homeParticipant: {
              include: {
                player: {
                  select: {
                    id: true,
                    ingameName: true,
                    battlegroup: true,
                    championPrestige: true,
                    avatar: true,
                  },
                },
              },
            },
            awayParticipant: {
              include: {
                player: {
                  select: {
                    id: true,
                    ingameName: true,
                    battlegroup: true,
                    championPrestige: true,
                    avatar: true,
                  },
                },
              },
            },
            winnerParticipant: {
              include: {
                player: {
                  select: {
                    id: true,
                    ingameName: true,
                    battlegroup: true,
                    championPrestige: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { round: "asc" },
            { matchNumber: "asc" },
          ],
        },
        _count: { select: { matches: true } },
      },
      orderBy: [
        { status: "asc" },
        { startsAt: "asc" },
        { createdAt: "desc" },
      ],
    }),
  ]);

  const canManageAllianceTournaments = canPlanAllianceWar(player, player.isBotAdmin);
  const manageableTournamentIds = tournaments
    .filter((tournament) => {
      if (player.isBotAdmin || tournament.createdById === player.id) return true;
      return !!tournament.allianceId &&
        tournament.allianceId === player.allianceId &&
        canManageAllianceTournaments;
    })
    .map((tournament) => tournament.id);
  const bgColors = {
    1: player.alliance?.battlegroup1Color || "#ef4444",
    2: player.alliance?.battlegroup2Color || "#22c55e",
    3: player.alliance?.battlegroup3Color || "#3b82f6",
  };

  const serializeParticipant = (participant: typeof tournaments[number]["participants"][number]) => ({
    ...participant,
    checkedInAt: participant.checkedInAt?.toISOString() ?? null,
    createdAt: participant.createdAt.toISOString(),
    updatedAt: participant.updatedAt.toISOString(),
  });

  const serializedTournaments = tournaments.map((tournament) => ({
    ...tournament,
    startsAt: tournament.startsAt?.toISOString() ?? null,
    checkInStartsAt: tournament.checkInStartsAt?.toISOString() ?? null,
    createdAt: tournament.createdAt.toISOString(),
    updatedAt: tournament.updatedAt.toISOString(),
    participants: tournament.participants.map(serializeParticipant),
    matches: tournament.matches.map((match) => ({
      ...match,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      createdAt: match.createdAt.toISOString(),
      updatedAt: match.updatedAt.toISOString(),
      homeParticipant: match.homeParticipant ? serializeParticipant(match.homeParticipant) : null,
      awayParticipant: match.awayParticipant ? serializeParticipant(match.awayParticipant) : null,
      winnerParticipant: match.winnerParticipant ? serializeParticipant(match.winnerParticipant) : null,
    })),
  }));

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
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Alliance</p>
            <p className="font-semibold text-slate-200">{player.alliance?.name ?? "Alliance"}</p>
          </div>
        </div>

        <BattlegroundsTournamentsClient
          allianceName={player.alliance?.name ?? "Alliance"}
          hasAlliance={!!player.allianceId}
          currentPlayerId={player.id}
          bgColors={bgColors}
          players={members}
          tournaments={serializedTournaments}
          canCreate={true}
          manageableTournamentIds={manageableTournamentIds}
        />
      </div>
    </div>
  );
}
