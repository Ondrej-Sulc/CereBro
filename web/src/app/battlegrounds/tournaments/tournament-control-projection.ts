import {
  BattlegroundsMatchBracket,
  BattlegroundsMatchStatus,
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentScope,
  BattlegroundsTournamentStatus,
  Prisma,
  TournamentParticipantStatus,
} from "@prisma/client";
import type { UserPlayerWithAlliance } from "../../../lib/auth-helpers";
import { canPlanAllianceWar } from "../../../lib/alliance-permissions";
import { prisma } from "../../../lib/prisma";
import {
  evaluateTournamentStatus,
  type TournamentStatusEvaluation,
} from "./tournament-status";

const tournamentMemberSelect = {
  id: true,
  ingameName: true,
  allianceId: true,
  battlegroup: true,
  championPrestige: true,
  avatar: true,
} satisfies Prisma.PlayerSelect;

const tournamentParticipantInclude = {
  player: { select: tournamentMemberSelect },
} satisfies Prisma.BattlegroundsTournamentParticipantInclude;

export type TournamentMember = {
  id: string;
  ingameName: string;
  allianceId: string | null;
  battlegroup: number | null;
  championPrestige: number | null;
  avatar: string | null;
};

export type TournamentParticipant = {
  id: string;
  seed: number | null;
  battlegroup: number | null;
  status: TournamentParticipantStatus;
  checkedInAt: string | null;
  player: TournamentMember;
};

export type TournamentMatch = {
  id: string;
  bracket: BattlegroundsMatchBracket;
  round: number;
  matchNumber: number;
  status: BattlegroundsMatchStatus;
  homeParticipantId: string | null;
  awayParticipantId: string | null;
  winnerParticipantId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string | null;
  notes: string | null;
  homeParticipant: TournamentParticipant | null;
  awayParticipant: TournamentParticipant | null;
  winnerParticipant: TournamentParticipant | null;
};

export type TournamentSummary = {
  id: string;
  name: string;
  description: string | null;
  scope: BattlegroundsTournamentScope;
  format: BattlegroundsTournamentFormat;
  status: BattlegroundsTournamentStatus;
  startsAt: string | null;
  checkInStartsAt: string | null;
  createdAt: string;
  allianceId: string | null;
  createdById: string;
  createdBy: { ingameName: string };
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  _count: { matches: number };
};

export type ProjectedTournamentMatch = TournamentMatch & {
  waitingForOpponent: boolean;
};

export type ProjectedTournament = Omit<TournamentSummary, "participants" | "matches"> & {
  participants: TournamentParticipant[];
  matches: ProjectedTournamentMatch[];
};

export type TournamentStanding = {
  participantId: string;
  participant: TournamentParticipant;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type TournamentControlProjection = {
  tournament: ProjectedTournament;
  players: TournamentMember[];
  availablePlayers: TournamentMember[];
  standings: TournamentStanding[];
  matchRounds: Array<[number, ProjectedTournamentMatch[]]>;
  bracketRounds: Record<
    BattlegroundsMatchBracket,
    Array<[number, ProjectedTournamentMatch[]]>
  >;
  singleEliminationRounds: Array<{
    round: number;
    slots: Array<{
      matchNumber: number;
      match: ProjectedTournamentMatch | null;
    }>;
  }>;
  bracketSize: number;
  summonerGuidance: { tone: string; text: string };
  status: TournamentStatusEvaluation;
  championName: string | null;
  viewer: {
    canManage: boolean;
    participantId: string | null;
    canJoin: boolean;
    canCheckIn: boolean;
    canStart: boolean;
    canEditField: boolean;
    canReportResults: boolean;
    canEditManualMatches: boolean;
  };
};

function sortParticipants(participants: TournamentParticipant[]) {
  return [...participants].sort((a, b) => {
    const seedDifference = (a.seed ?? 9999) - (b.seed ?? 9999);
    if (seedDifference !== 0) return seedDifference;
    const battlegroupDifference = (a.battlegroup ?? 99) - (b.battlegroup ?? 99);
    if (battlegroupDifference !== 0) return battlegroupDifference;
    return a.player.ingameName.localeCompare(b.player.ingameName);
  });
}

function groupMatchesByRound(matches: ProjectedTournamentMatch[]) {
  const groups = new Map<number, ProjectedTournamentMatch[]>();
  for (const match of matches) {
    const roundMatches = groups.get(match.round) ?? [];
    roundMatches.push(match);
    groups.set(match.round, roundMatches);
  }

  return [...groups.entries()]
    .map(([round, roundMatches]) => [
      round,
      roundMatches.sort((a, b) => a.matchNumber - b.matchNumber),
    ] as [number, ProjectedTournamentMatch[]])
    .sort(([a], [b]) => a - b);
}

function nextPowerOfTwo(value: number) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function summonerCountGuidance(tournament: TournamentSummary) {
  const count = tournament.participants.length;
  if (count < 2) {
    return {
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      text: "Add at least 2 summoners to start fights.",
    };
  }

  if (
    tournament.format === BattlegroundsTournamentFormat.SINGLE_ELIMINATION ||
    tournament.format === BattlegroundsTournamentFormat.DOUBLE_ELIMINATION
  ) {
    const bracketName = tournament.format === BattlegroundsTournamentFormat.DOUBLE_ELIMINATION
      ? "double-elim"
      : "single-elim";
    if (isPowerOfTwo(count)) {
      return {
        tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        text: `Clean ${count}-summoner ${bracketName} bracket with no byes.`,
      };
    }

    const target = nextPowerOfTwo(count);
    const needed = target - count;
    return {
      tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
      text: `${count} works with ${needed} ${needed === 1 ? "bye" : "byes"}. Add ${needed} ${needed === 1 ? "summoner" : "summoners"} for a clean ${target}-summoner ${bracketName} bracket.`,
    };
  }

  if (tournament.format === BattlegroundsTournamentFormat.ROUND_ROBIN) {
    return {
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      text: `${count} summoners create ${count * (count - 1) / 2} fights.`,
    };
  }

  return {
    tone: "border-slate-700 bg-slate-900 text-slate-300",
    text: `${count} summoners. Pairings are manual for this format.`,
  };
}

function waitingForOpponent(tournament: TournamentSummary, match: TournamentMatch) {
  if (match.round === 1 || (match.homeParticipantId && match.awayParticipantId)) {
    return false;
  }

  const feederMatchNumbers = [match.matchNumber * 2 - 1, match.matchNumber * 2];
  return tournament.matches.some((candidate) => (
    candidate.bracket === match.bracket &&
    candidate.round === match.round - 1 &&
    feederMatchNumbers.includes(candidate.matchNumber) &&
    candidate.status !== BattlegroundsMatchStatus.FINAL
  ));
}

function buildStandings(
  participants: TournamentParticipant[],
  matches: ProjectedTournamentMatch[]
) {
  const standings = new Map<string, TournamentStanding>();
  for (const participant of participants) {
    standings.set(participant.id, {
      participantId: participant.id,
      participant,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const match of matches) {
    if (
      match.status !== BattlegroundsMatchStatus.FINAL ||
      !match.homeParticipantId ||
      !match.awayParticipantId
    ) {
      continue;
    }

    const home = standings.get(match.homeParticipantId);
    const away = standings.get(match.awayParticipantId);
    if (!home || !away) continue;

    home.pointsFor += match.homeScore ?? 0;
    home.pointsAgainst += match.awayScore ?? 0;
    away.pointsFor += match.awayScore ?? 0;
    away.pointsAgainst += match.homeScore ?? 0;

    if (match.winnerParticipantId === match.homeParticipantId) {
      home.wins += 1;
      away.losses += 1;
    } else if (match.winnerParticipantId === match.awayParticipantId) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  const participantOrder = new Map(
    participants.map((participant, index) => [participant.id, index])
  );
  return [...standings.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const pointDifference = (b.pointsFor - b.pointsAgainst) -
      (a.pointsFor - a.pointsAgainst);
    if (pointDifference !== 0) return pointDifference;
    return (participantOrder.get(a.participantId) ?? 0) -
      (participantOrder.get(b.participantId) ?? 0);
  });
}

function buildSingleEliminationRounds(
  tournament: ProjectedTournament
): TournamentControlProjection["singleEliminationRounds"] {
  if (tournament.format !== BattlegroundsTournamentFormat.SINGLE_ELIMINATION) {
    return [];
  }

  const bracketSize = Math.max(2, nextPowerOfTwo(tournament.participants.length));
  const roundCount = Math.log2(bracketSize);
  const matchesByRoundAndNumber = new Map(
    tournament.matches.map((match) => [
      `${match.round}:${match.matchNumber}`,
      match,
    ])
  );

  return Array.from({ length: roundCount }, (_, roundIndex) => {
    const round = roundIndex + 1;
    const slotCount = bracketSize / 2 ** round;
    return {
      round,
      slots: Array.from({ length: slotCount }, (_, slotIndex) => {
        const matchNumber = slotIndex + 1;
        return {
          matchNumber,
          match: matchesByRoundAndNumber.get(`${round}:${matchNumber}`) ?? null,
        };
      }),
    };
  });
}

export function projectTournamentControl({
  tournament,
  players,
  currentPlayerId,
  canManage,
}: {
  tournament: TournamentSummary;
  players: TournamentMember[];
  currentPlayerId: string;
  canManage: boolean;
}): TournamentControlProjection {
  const participants = sortParticipants(tournament.participants);
  const matches = tournament.matches.map((match) => ({
    ...match,
    waitingForOpponent: waitingForOpponent(tournament, match),
  }));
  const projectedTournament: ProjectedTournament = {
    ...tournament,
    participants,
    matches,
  };
  const status = evaluateTournamentStatus({
    format: tournament.format,
    status: tournament.status,
    participantCount: participants.length,
    matches,
  });
  const currentParticipant = participants.find(
    (participant) => participant.player.id === currentPlayerId
  ) ?? null;
  const bracketRounds = Object.fromEntries(
    Object.values(BattlegroundsMatchBracket).map((bracket) => [
      bracket,
      groupMatchesByRound(matches.filter((match) => match.bracket === bracket)),
    ])
  ) as TournamentControlProjection["bracketRounds"];
  const availablePlayers = players
    .filter((player) => !participants.some((entry) => entry.player.id === player.id))
    .filter((player) => (
      tournament.scope !== BattlegroundsTournamentScope.ALLIANCE ||
      player.allianceId === tournament.allianceId
    ))
    .sort((a, b) => (
      (a.battlegroup ?? 99) - (b.battlegroup ?? 99) ||
      a.ingameName.localeCompare(b.ingameName)
    ));

  return {
    tournament: projectedTournament,
    players,
    availablePlayers,
    standings: buildStandings(participants, matches),
    matchRounds: groupMatchesByRound(matches),
    bracketRounds,
    singleEliminationRounds: buildSingleEliminationRounds(projectedTournament),
    bracketSize: Math.max(2, nextPowerOfTwo(participants.length)),
    summonerGuidance: summonerCountGuidance(tournament),
    status,
    championName: participants.find(
      (participant) => participant.id === status.championParticipantId
    )?.player.ingameName ?? null,
    viewer: {
      canManage,
      participantId: currentParticipant?.id ?? null,
      canJoin: !currentParticipant && status.registrationOpen,
      canCheckIn: !!currentParticipant &&
        currentParticipant.status !== TournamentParticipantStatus.CHECKED_IN &&
        status.checkInOpen,
      canStart: canManage && status.canStart,
      canEditField: canManage && status.canEditField,
      canReportResults: canManage && status.canReportResults,
      canEditManualMatches: canManage && status.canEditManualMatches,
    },
  };
}

export async function loadTournamentControlProjection({
  tournamentId,
  player,
}: {
  tournamentId: string;
  player: UserPlayerWithAlliance;
}) {
  const [players, tournament] = await Promise.all([
    prisma.player.findMany({
      where: player.allianceId
        ? { OR: [{ allianceId: player.allianceId }, { allianceId: null }] }
        : { allianceId: null },
      select: tournamentMemberSelect,
      orderBy: [{ battlegroup: "asc" }, { ingameName: "asc" }],
    }),
    prisma.battlegroundsTournament.findFirst({
      where: {
        id: tournamentId,
        OR: [
          { scope: BattlegroundsTournamentScope.COMMUNITY },
          ...(player.allianceId ? [{ allianceId: player.allianceId }] : []),
          { createdById: player.id },
        ],
      },
      include: {
        createdBy: { select: { ingameName: true } },
        alliance: { select: { name: true } },
        participants: {
          include: tournamentParticipantInclude,
          orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
        },
        matches: {
          include: {
            homeParticipant: {
              include: tournamentParticipantInclude,
            },
            awayParticipant: {
              include: tournamentParticipantInclude,
            },
            winnerParticipant: {
              include: tournamentParticipantInclude,
            },
          },
          orderBy: [
            { bracket: "asc" },
            { round: "asc" },
            { matchNumber: "asc" },
          ],
        },
        _count: { select: { matches: true } },
      },
    }),
  ]);

  if (!tournament) return null;

  const canManage = player.isBotAdmin ||
    tournament.createdById === player.id ||
    (
      !!tournament.allianceId &&
      tournament.allianceId === player.allianceId &&
      canPlanAllianceWar(player, player.isBotAdmin)
    );
  const serializeParticipant = (
    participant: typeof tournament.participants[number]
  ) => ({
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
      homeParticipant: match.homeParticipant
        ? serializeParticipant(match.homeParticipant)
        : null,
      awayParticipant: match.awayParticipant
        ? serializeParticipant(match.awayParticipant)
        : null,
      winnerParticipant: match.winnerParticipant
        ? serializeParticipant(match.winnerParticipant)
        : null,
    })),
  };

  return {
    allianceName: player.alliance?.name ?? "Alliance",
    bgColors: {
      1: player.alliance?.battlegroup1Color || "#ef4444",
      2: player.alliance?.battlegroup2Color || "#22c55e",
      3: player.alliance?.battlegroup3Color || "#3b82f6",
    },
    projection: projectTournamentControl({
      tournament: serializedTournament,
      players,
      currentPlayerId: player.id,
      canManage,
    }),
  };
}
