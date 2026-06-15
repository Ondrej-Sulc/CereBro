import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { canPlanAllianceWar } from "@/lib/alliance-permissions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { BattlegroundsTournamentsClient } from "../tournaments-client";

export const metadata: Metadata = {
  title: "Battlegrounds Tournament - CereBro",
  description: "Manage a Battlegrounds tournament.",
};

export const dynamic = "force-dynamic";

export default async function BattlegroundsTournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const [{ tournamentId }, player] = await Promise.all([
    params,
    getUserPlayerWithAlliance(),
  ]);

  if (!player) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-10 text-center">
          <Trophy className="mx-auto h-12 w-12 text-slate-700" />
          <h1 className="mt-4 text-2xl font-bold text-white">Login Required</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Sign in with Discord and select a CereBro profile to manage this tournament.
          </p>
        </div>
      </div>
    );
  }

  logger.info(
    { userId: player.id, allianceId: player.allianceId, tournamentId },
    "User accessing Battlegrounds tournament detail page"
  );

  const [members, tournament] = await Promise.all([
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
    prisma.battlegroundsTournament.findFirst({
      where: {
        id: tournamentId,
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
    }),
  ]);

  if (!tournament) notFound();

  const canManageAllianceTournaments = canPlanAllianceWar(player, player.isBotAdmin);
  const canManageTournament = player.isBotAdmin ||
    tournament.createdById === player.id ||
    (!!tournament.allianceId &&
      tournament.allianceId === player.allianceId &&
      canManageAllianceTournaments);

  const bgColors = {
    1: player.alliance?.battlegroup1Color || "#ef4444",
    2: player.alliance?.battlegroup2Color || "#22c55e",
    3: player.alliance?.battlegroup3Color || "#3b82f6",
  };

  const serializeParticipant = (participant: typeof tournament.participants[number]) => ({
    ...participant,
    checkedInAt: participant.checkedInAt?.toISOString() ?? null,
    createdAt: participant.createdAt.toISOString(),
    updatedAt: participant.updatedAt.toISOString(),
  });

  const serializedTournament = {
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
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)]">
      <div className="container mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="mb-4">
          <Button asChild variant="ghost" className="text-slate-400 hover:text-white">
            <Link href="/battlegrounds/tournaments">
              <ArrowLeft className="h-4 w-4" />
              Tournaments
            </Link>
          </Button>
        </div>

        <BattlegroundsTournamentsClient
          allianceName={player.alliance?.name ?? "Alliance"}
          currentPlayerId={player.id}
          bgColors={bgColors}
          players={members}
          tournaments={[serializedTournament]}
          canCreate={false}
          manageableTournamentIds={canManageTournament ? [tournament.id] : []}
          showTournamentQueue={false}
        />
      </div>
    </div>
  );
}
