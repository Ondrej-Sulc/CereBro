'use server';

import {
  BattlegroundsTournamentFormat,
  BattlegroundsMatchStatus,
  BattlegroundsTournamentScope,
  BattlegroundsTournamentStatus,
  TournamentParticipantStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { canPlanAllianceWar } from "@/lib/alliance-permissions";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";

const TOURNAMENTS_PATH = "/battlegrounds/tournaments";

export type TournamentActionResult =
  | { success: true }
  | { success: false; error: string };

async function requireTournamentPlanner() {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("You must be logged in to manage tournaments.");
  }

  return player;
}

function canManageTournament(
  player: Awaited<ReturnType<typeof requireTournamentPlanner>>,
  tournament: { createdById: string; allianceId: string | null }
) {
  if (player.isBotAdmin || tournament.createdById === player.id) return true;

  if (
    tournament.allianceId &&
    player.allianceId === tournament.allianceId &&
    canPlanAllianceWar(player, player.isBotAdmin)
  ) {
    return true;
  }

  return false;
}

function parseScope(value: FormDataEntryValue | null, hasAlliance: boolean) {
  if (value === BattlegroundsTournamentScope.ALLIANCE && hasAlliance) {
    return BattlegroundsTournamentScope.ALLIANCE;
  }

  return BattlegroundsTournamentScope.COMMUNITY;
}

function readTrimmedString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalLocalDate(formData: FormData, key: string) {
  const value = readTrimmedString(formData, key);
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) return undefined;

  const offsetMinutes = Number(readTrimmedString(formData, `${key}TimezoneOffsetMinutes`));
  if (!Number.isInteger(offsetMinutes)) return undefined;

  const [, year, month, day, hour, minute, second = "0"] = match;
  const parsed = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ) + offsetMinutes * 60_000
  );

  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function parseFormat(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return BattlegroundsTournamentFormat.SINGLE_ELIMINATION;
  return Object.values(BattlegroundsTournamentFormat).includes(value as BattlegroundsTournamentFormat)
    ? value as BattlegroundsTournamentFormat
    : BattlegroundsTournamentFormat.SINGLE_ELIMINATION;
}

function parseParticipantStatus(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return TournamentParticipantStatus.CONFIRMED;
  return Object.values(TournamentParticipantStatus).includes(value as TournamentParticipantStatus)
    ? value as TournamentParticipantStatus
    : TournamentParticipantStatus.CONFIRMED;
}

function readPositiveInteger(formData: FormData, key: string) {
  const value = readTrimmedString(formData, key);
  if (!value) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readOptionalScore(formData: FormData, key: string) {
  const value = readTrimmedString(formData, key);
  if (!value) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseMatchStatus(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  return Object.values(BattlegroundsMatchStatus).includes(value as BattlegroundsMatchStatus)
    ? value as BattlegroundsMatchStatus
    : null;
}

type TournamentForMatches = Awaited<ReturnType<typeof loadManagedTournamentForMatches>>;

async function loadManagedTournamentForMatches(
  player: Awaited<ReturnType<typeof requireTournamentPlanner>>,
  tournamentId: string
) {
  const tournament = await prisma.battlegroundsTournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      allianceId: true,
      createdById: true,
      format: true,
      participants: {
        select: {
          id: true,
          seed: true,
          createdAt: true,
        },
      },
      matches: {
        select: {
          id: true,
          round: true,
          matchNumber: true,
          status: true,
          homeParticipantId: true,
          awayParticipantId: true,
          winnerParticipantId: true,
          homeScore: true,
          awayScore: true,
        },
        orderBy: [
          { round: "asc" },
          { matchNumber: "asc" },
        ],
      },
    },
  });

  if (!tournament || !canManageTournament(player, tournament)) {
    return null;
  }

  return tournament;
}

function sortedEntrants(tournament: NonNullable<TournamentForMatches>) {
  return [...tournament.participants].sort((a, b) => {
    const aSeed = a.seed ?? 9999;
    const bSeed = b.seed ?? 9999;
    if (aSeed !== bSeed) return aSeed - bSeed;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function standingsOrder(tournament: NonNullable<TournamentForMatches>) {
  const standings = new Map<string, { participantId: string; wins: number; losses: number; pointsFor: number; pointsAgainst: number; seed: number; createdAt: Date }>();

  for (const entrant of tournament.participants) {
    standings.set(entrant.id, {
      participantId: entrant.id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      seed: entrant.seed ?? 9999,
      createdAt: entrant.createdAt,
    });
  }

  for (const match of tournament.matches) {
    if (match.status !== BattlegroundsMatchStatus.FINAL || !match.homeParticipantId || !match.awayParticipantId) continue;

    const home = standings.get(match.homeParticipantId);
    const away = standings.get(match.awayParticipantId);
    if (!home || !away) continue;

    home.pointsFor += match.homeScore ?? 0;
    home.pointsAgainst += match.awayScore ?? 0;
    away.pointsFor += match.awayScore ?? 0;
    away.pointsAgainst += match.homeScore ?? 0;

    if (match.winnerParticipantId === home.participantId) {
      home.wins += 1;
      away.losses += 1;
    } else if (match.winnerParticipantId === away.participantId) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  return [...standings.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    if (a.seed !== b.seed) return a.seed - b.seed;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function pairHighLow(participantIds: string[]) {
  const pairs: Array<[string, string | null]> = [];
  let left = 0;
  let right = participantIds.length - 1;

  while (left <= right) {
    if (left === right) {
      pairs.push([participantIds[left], null]);
    } else {
      pairs.push([participantIds[left], participantIds[right]]);
    }
    left += 1;
    right -= 1;
  }

  return pairs;
}

function pairAdjacent(participantIds: string[]) {
  const pairs: Array<[string, string | null]> = [];

  for (let index = 0; index < participantIds.length; index += 2) {
    pairs.push([participantIds[index], participantIds[index + 1] ?? null]);
  }

  return pairs;
}

function roundRobinPairs(participantIds: string[]) {
  const pairs: Array<{ round: number; homeParticipantId: string; awayParticipantId: string | null }> = [];

  for (let homeIndex = 0; homeIndex < participantIds.length; homeIndex += 1) {
    for (let awayIndex = homeIndex + 1; awayIndex < participantIds.length; awayIndex += 1) {
      pairs.push({
        round: homeIndex + 1,
        homeParticipantId: participantIds[homeIndex],
        awayParticipantId: participantIds[awayIndex],
      });
    }
  }

  return pairs;
}

function nextRound(tournament: NonNullable<TournamentForMatches>) {
  return tournament.matches.reduce((round, match) => Math.max(round, match.round), 0) + 1;
}

function singleEliminationPairs(tournament: NonNullable<TournamentForMatches>, round: number) {
  if (round === 1) {
    return { pairs: pairHighLow(sortedEntrants(tournament).map((entrant) => entrant.id)) };
  }

  const previousRoundMatches = tournament.matches
    .filter((match) => match.round === round - 1)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  if (previousRoundMatches.length === 0) {
    return { error: "Generate the previous round before creating the next one." };
  }

  const unresolvedMatch = previousRoundMatches.find((match) => (
    match.status !== BattlegroundsMatchStatus.FINAL || !match.winnerParticipantId
  ));
  if (unresolvedMatch) {
    return { error: `Finish round ${round - 1} before generating round ${round}.` };
  }

  const winnerIds = previousRoundMatches
    .map((match) => match.winnerParticipantId)
    .filter((participantId): participantId is string => Boolean(participantId));

  if (winnerIds.length < 2) {
    return { error: "Single elimination bracket is complete." };
  }

  return { pairs: pairAdjacent(winnerIds) };
}

function buildGeneratedMatches(tournament: NonNullable<TournamentForMatches>) {
  const seededIds = sortedEntrants(tournament).map((entrant) => entrant.id);
  const rankedIds = standingsOrder(tournament).map((standing) => standing.participantId);

  if (seededIds.length < 2) {
    return { error: "Add at least two participants before generating matches." };
  }

  if (tournament.format === BattlegroundsTournamentFormat.ROUND_ROBIN) {
    if (tournament.matches.length > 0) {
      return { error: "Round robin schedule already exists. Add manual matches for adjustments." };
    }

    return {
      matches: roundRobinPairs(seededIds).map((pair, index) => ({
        tournamentId: tournament.id,
        round: pair.round,
        matchNumber: index + 1,
        homeParticipantId: pair.homeParticipantId,
        awayParticipantId: pair.awayParticipantId,
        status: BattlegroundsMatchStatus.READY,
      })),
    };
  }

  const round = nextRound(tournament);
  const generatedPairs = tournament.format === BattlegroundsTournamentFormat.SINGLE_ELIMINATION
    ? singleEliminationPairs(tournament, round)
    : {
        pairs: tournament.format === BattlegroundsTournamentFormat.DOUBLE_ELIMINATION
          ? pairHighLow(round === 1 ? seededIds : rankedIds)
          : pairAdjacent(rankedIds),
      };

  if ("error" in generatedPairs) {
    return { error: generatedPairs.error };
  }

  return {
    matches: generatedPairs.pairs.map(([homeParticipantId, awayParticipantId], index) => ({
      tournamentId: tournament.id,
      round,
      matchNumber: index + 1,
      homeParticipantId,
      awayParticipantId,
      status: BattlegroundsMatchStatus.READY,
    })),
  };
}

export const createTournament = withActionContext(
  "createBattlegroundsTournament",
  async (formData: FormData): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();
    const name = readTrimmedString(formData, "name");
    const description = readTrimmedString(formData, "description");
    const startsAt = readOptionalLocalDate(formData, "startsAt");
    const checkInStartsAt = readOptionalLocalDate(formData, "checkInStartsAt");
    const scope = parseScope(formData.get("scope"), !!player.allianceId);

    if (!name) {
      return { success: false, error: "Tournament name is required." };
    }

    if (startsAt === undefined || checkInStartsAt === undefined) {
      return { success: false, error: "Use valid dates with a browser timezone or leave date fields empty." };
    }

    await prisma.battlegroundsTournament.create({
      data: {
        allianceId: scope === BattlegroundsTournamentScope.ALLIANCE ? player.allianceId : null,
        createdById: player.id,
        name,
        description: description || null,
        scope,
        format: parseFormat(formData.get("format")),
        startsAt,
        checkInStartsAt,
      },
    });

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const updateTournamentStatus = withActionContext(
  "updateBattlegroundsTournamentStatus",
  async (tournamentId: string, status: BattlegroundsTournamentStatus): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();

    if (!Object.values(BattlegroundsTournamentStatus).includes(status)) {
      return { success: false, error: "Unknown tournament status." };
    }

    const tournament = await prisma.battlegroundsTournament.findUnique({
      where: { id: tournamentId },
      select: { allianceId: true, createdById: true },
    });

    if (!tournament || !canManageTournament(player, tournament)) {
      return { success: false, error: "Tournament not found." };
    }

    await prisma.battlegroundsTournament.update({
      where: { id: tournamentId },
      data: { status },
    });

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const addTournamentParticipant = withActionContext(
  "addBattlegroundsTournamentParticipant",
  async (formData: FormData): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();
    const tournamentId = readTrimmedString(formData, "tournamentId");
    const playerId = readTrimmedString(formData, "playerId");
    const rawSeed = readTrimmedString(formData, "seed");

    if (!tournamentId || !playerId) {
      return { success: false, error: "Choose a tournament and player." };
    }

    const [tournament, entrant] = await Promise.all([
      prisma.battlegroundsTournament.findUnique({
        where: { id: tournamentId },
        select: { allianceId: true, createdById: true, scope: true },
      }),
      prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, allianceId: true, battlegroup: true },
      }),
    ]);

    if (!tournament || !canManageTournament(player, tournament)) {
      return { success: false, error: "Tournament not found." };
    }

    if (!entrant) {
      return { success: false, error: "Player not found." };
    }

    if (tournament.scope === BattlegroundsTournamentScope.ALLIANCE && entrant.allianceId !== tournament.allianceId) {
      return { success: false, error: "That player is not in this alliance tournament." };
    }

    const seed = rawSeed ? Number(rawSeed) : null;
    if (seed !== null && (!Number.isInteger(seed) || seed < 1)) {
      return { success: false, error: "Seed must be a positive whole number." };
    }

    try {
      await prisma.battlegroundsTournamentParticipant.create({
        data: {
          tournamentId,
          playerId,
          seed,
          battlegroup: entrant.battlegroup,
          status: parseParticipantStatus(formData.get("status")),
        },
      });
    } catch {
      return { success: false, error: "This player or seed is already in the tournament." };
    }

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const removeTournamentParticipant = withActionContext(
  "removeBattlegroundsTournamentParticipant",
  async (participantId: string): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();

    const participant = await prisma.battlegroundsTournamentParticipant.findUnique({
      where: { id: participantId },
      select: { tournament: { select: { allianceId: true, createdById: true } } },
    });

    if (!participant || !canManageTournament(player, participant.tournament)) {
      return { success: false, error: "Participant not found." };
    }

    await prisma.battlegroundsTournamentParticipant.delete({
      where: { id: participantId },
    });

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const joinTournament = withActionContext(
  "joinBattlegroundsTournament",
  async (tournamentId: string): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();

    const tournament = await prisma.battlegroundsTournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, scope: true, allianceId: true, status: true },
    });

    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }

    if (!["REGISTRATION", "CHECK_IN"].includes(tournament.status)) {
      return { success: false, error: "Registration is not open for this tournament." };
    }

    if (tournament.scope === BattlegroundsTournamentScope.ALLIANCE && tournament.allianceId !== player.allianceId) {
      return { success: false, error: "This tournament is limited to its alliance." };
    }

    try {
      await prisma.battlegroundsTournamentParticipant.create({
        data: {
          tournamentId,
          playerId: player.id,
          battlegroup: player.allianceId === tournament.allianceId ? player.battlegroup : null,
          status: tournament.status === "CHECK_IN"
            ? TournamentParticipantStatus.CHECKED_IN
            : TournamentParticipantStatus.CONFIRMED,
          checkedInAt: tournament.status === "CHECK_IN" ? new Date() : null,
        },
      });
    } catch {
      return { success: false, error: "You are already in this tournament." };
    }

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const checkInTournamentParticipant = withActionContext(
  "checkInBattlegroundsTournamentParticipant",
  async (tournamentId: string): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();

    const participant = await prisma.battlegroundsTournamentParticipant.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: player.id,
        },
      },
      select: {
        id: true,
        status: true,
        tournament: {
          select: {
            status: true,
            scope: true,
            allianceId: true,
          },
        },
      },
    });

    if (!participant) {
      return { success: false, error: "Join this tournament before checking in." };
    }

    if (participant.tournament.scope === BattlegroundsTournamentScope.ALLIANCE && participant.tournament.allianceId !== player.allianceId) {
      return { success: false, error: "This tournament is limited to its alliance." };
    }

    if (participant.tournament.status !== BattlegroundsTournamentStatus.CHECK_IN) {
      return { success: false, error: "Check-in is not open for this tournament." };
    }

    if (participant.status === TournamentParticipantStatus.CHECKED_IN) {
      return { success: true };
    }

    await prisma.battlegroundsTournamentParticipant.update({
      where: { id: participant.id },
      data: {
        status: TournamentParticipantStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
    });

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const generateTournamentMatches = withActionContext(
  "generateBattlegroundsTournamentMatches",
  async (tournamentId: string): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();
    const tournament = await loadManagedTournamentForMatches(player, tournamentId);

    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }

    const generated = buildGeneratedMatches(tournament);
    if ("error" in generated) {
      return { success: false, error: generated.error ?? "Unable to generate matches." };
    }

    try {
      await prisma.battlegroundsTournamentMatch.createMany({
        data: generated.matches,
      });
    } catch {
      return { success: false, error: "Matches already exist for that generated round." };
    }

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const createTournamentMatch = withActionContext(
  "createBattlegroundsTournamentMatch",
  async (formData: FormData): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();
    const tournamentId = readTrimmedString(formData, "tournamentId");
    const round = readPositiveInteger(formData, "round");
    const matchNumber = readPositiveInteger(formData, "matchNumber");
    const homeParticipantId = readTrimmedString(formData, "homeParticipantId");
    const awayParticipantId = readTrimmedString(formData, "awayParticipantId") || null;
    const notes = readTrimmedString(formData, "notes");

    if (!tournamentId || !homeParticipantId || round === null || matchNumber === null) {
      return { success: false, error: "Choose a tournament, round, match number, and first player." };
    }

    if (round === undefined || matchNumber === undefined) {
      return { success: false, error: "Round and match number must be positive whole numbers." };
    }

    if (awayParticipantId && awayParticipantId === homeParticipantId) {
      return { success: false, error: "A player cannot face themselves." };
    }

    const tournament = await loadManagedTournamentForMatches(player, tournamentId);
    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }

    const participantIds = new Set(tournament.participants.map((participant) => participant.id));
    if (!participantIds.has(homeParticipantId) || (awayParticipantId && !participantIds.has(awayParticipantId))) {
      return { success: false, error: "Both match players must be in this tournament." };
    }

    try {
      await prisma.battlegroundsTournamentMatch.create({
        data: {
          tournamentId,
          round,
          matchNumber,
          homeParticipantId,
          awayParticipantId,
          status: BattlegroundsMatchStatus.READY,
          notes: notes || null,
        },
      });
    } catch {
      return { success: false, error: "A match already exists with that round and match number." };
    }

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const recordTournamentMatchResult = withActionContext(
  "recordBattlegroundsTournamentMatchResult",
  async (formData: FormData): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();
    const matchId = readTrimmedString(formData, "matchId");
    const homeScore = readOptionalScore(formData, "homeScore");
    const awayScore = readOptionalScore(formData, "awayScore");
    const requestedWinnerId = readTrimmedString(formData, "winnerParticipantId") || null;
    const status = parseMatchStatus(formData.get("status"));
    const notes = readTrimmedString(formData, "notes");

    if (!matchId) {
      return { success: false, error: "Choose a match to report." };
    }

    if (homeScore === undefined || awayScore === undefined) {
      return { success: false, error: "Scores must be whole numbers or left empty." };
    }

    if (!status) {
      return { success: false, error: "Choose a valid match status." };
    }

    const match = await prisma.battlegroundsTournamentMatch.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        homeParticipantId: true,
        awayParticipantId: true,
        tournament: {
          select: {
            id: true,
            allianceId: true,
            createdById: true,
          },
        },
      },
    });

    if (!match || !canManageTournament(player, match.tournament)) {
      return { success: false, error: "Match not found." };
    }

    let winnerParticipantId = requestedWinnerId;
    if (!winnerParticipantId && homeScore !== null && awayScore !== null && homeScore !== awayScore) {
      winnerParticipantId = homeScore > awayScore ? match.homeParticipantId : match.awayParticipantId;
    }

    const validWinnerIds = new Set([match.homeParticipantId, match.awayParticipantId].filter(Boolean));
    if (winnerParticipantId && !validWinnerIds.has(winnerParticipantId)) {
      return { success: false, error: "Winner must be one of the match players." };
    }

    if (status === BattlegroundsMatchStatus.FINAL && !winnerParticipantId) {
      return { success: false, error: "Final matches need a winner." };
    }

    const isByeMatch = !match.awayParticipantId;
    if (status === BattlegroundsMatchStatus.FINAL && !isByeMatch) {
      if (homeScore === null || awayScore === null) {
        return { success: false, error: "Final matches need both scores." };
      }

      if (homeScore === awayScore) {
        return { success: false, error: "Final matches cannot end tied." };
      }

      const scoreWinnerId = homeScore > awayScore ? match.homeParticipantId : match.awayParticipantId;
      if (winnerParticipantId && winnerParticipantId !== scoreWinnerId) {
        return { success: false, error: "Winner must match the score." };
      }

      winnerParticipantId = scoreWinnerId;
    }

    await prisma.battlegroundsTournamentMatch.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        winnerParticipantId,
        status,
        notes: notes || null,
      },
    });

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const deleteTournamentMatch = withActionContext(
  "deleteBattlegroundsTournamentMatch",
  async (matchId: string): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();

    const match = await prisma.battlegroundsTournamentMatch.findUnique({
      where: { id: matchId },
      select: {
        tournament: {
          select: {
            allianceId: true,
            createdById: true,
          },
        },
      },
    });

    if (!match || !canManageTournament(player, match.tournament)) {
      return { success: false, error: "Match not found." };
    }

    await prisma.battlegroundsTournamentMatch.delete({
      where: { id: matchId },
    });

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);
