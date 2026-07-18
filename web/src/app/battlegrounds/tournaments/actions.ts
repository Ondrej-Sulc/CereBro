'use server';

import {
  BattlegroundsMatchStatus,
  BattlegroundsTournamentScope,
  BattlegroundsTournamentStatus,
  TournamentParticipantStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { canPlanAllianceWar } from "@/lib/alliance-permissions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";
import {
  generateTournamentBracket,
  reportTournamentMatchResult,
  startTournamentBracket,
} from "./tournament-bracket-operations";
import { isSupportedTournamentFormat } from "./tournament-labels";
import { validateTournamentStatusTransition } from "./tournament-status";

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
  return !!tournament.allianceId &&
    player.allianceId === tournament.allianceId &&
    canPlanAllianceWar(player, player.isBotAdmin);
}

function parseScope(value: FormDataEntryValue | null, hasAlliance: boolean) {
  return value === BattlegroundsTournamentScope.ALLIANCE && hasAlliance
    ? BattlegroundsTournamentScope.ALLIANCE
    : BattlegroundsTournamentScope.COMMUNITY;
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

  const offsetMinutes = Number(
    readTrimmedString(formData, `${key}TimezoneOffsetMinutes`)
  );
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

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseFormat(value: FormDataEntryValue | null) {
  return typeof value === "string" && isSupportedTournamentFormat(value)
    ? value
    : null;
}

function parseParticipantStatus(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return TournamentParticipantStatus.CONFIRMED;
  return Object.values(TournamentParticipantStatus).includes(
    value as TournamentParticipantStatus
  )
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
  return Object.values(BattlegroundsMatchStatus).includes(
    value as BattlegroundsMatchStatus
  )
    ? value as BattlegroundsMatchStatus
    : null;
}

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
      status: true,
      participants: { select: { id: true } },
    },
  });

  return tournament && canManageTournament(player, tournament)
    ? tournament
    : null;
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
    const format = parseFormat(formData.get("format"));

    if (!name) {
      return { success: false, error: "Tournament name is required." };
    }
    if (startsAt === undefined || checkInStartsAt === undefined) {
      return {
        success: false,
        error: "Use valid dates with a browser timezone or leave date fields empty.",
      };
    }
    if (!format) {
      return {
        success: false,
        error: "Choose single or double elimination.",
      };
    }

    await prisma.battlegroundsTournament.create({
      data: {
        allianceId: scope === BattlegroundsTournamentScope.ALLIANCE
          ? player.allianceId
          : null,
        createdById: player.id,
        name,
        description: description || null,
        scope,
        format,
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
  async (
    tournamentId: string,
    status: BattlegroundsTournamentStatus
  ): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();
    if (!Object.values(BattlegroundsTournamentStatus).includes(status)) {
      return { success: false, error: "Unknown tournament status." };
    }

    const tournament = await prisma.battlegroundsTournament.findUnique({
      where: { id: tournamentId },
      select: {
        allianceId: true,
        createdById: true,
        status: true,
        format: true,
        _count: { select: { participants: true } },
        matches: {
          select: {
            bracket: true,
            round: true,
            matchNumber: true,
            status: true,
            homeParticipantId: true,
            awayParticipantId: true,
            winnerParticipantId: true,
          },
        },
      },
    });

    if (!tournament || !canManageTournament(player, tournament)) {
      return { success: false, error: "Tournament not found." };
    }

    const transition = validateTournamentStatusTransition({
      format: tournament.format,
      status: tournament.status,
      participantCount: tournament._count?.participants ?? 0,
      matches: tournament.matches ?? [],
    }, status);
    if (!transition.allowed) return { success: false, error: transition.error };

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
        select: {
          allianceId: true,
          createdById: true,
          scope: true,
          status: true,
          _count: { select: { matches: true } },
        },
      }),
      prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, allianceId: true, battlegroup: true },
      }),
    ]);

    if (!tournament || !canManageTournament(player, tournament)) {
      return { success: false, error: "Tournament not found." };
    }
    if (
      tournament._count.matches > 0 ||
      !["DRAFT", "REGISTRATION", "CHECK_IN"].includes(tournament.status)
    ) {
      return {
        success: false,
        error: "Participants cannot be added after the bracket is created.",
      };
    }
    if (!entrant) {
      return { success: false, error: "Player not found." };
    }
    if (
      tournament.scope === BattlegroundsTournamentScope.ALLIANCE &&
      entrant.allianceId !== tournament.allianceId
    ) {
      return {
        success: false,
        error: "That player is not in this alliance tournament.",
      };
    }

    const seed = rawSeed ? Number(rawSeed) : null;
    if (seed !== null && (!Number.isInteger(seed) || seed < 1)) {
      return {
        success: false,
        error: "Seed must be a positive whole number.",
      };
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
      return {
        success: false,
        error: "This player or seed is already in the tournament.",
      };
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
      select: {
        tournament: {
          select: {
            allianceId: true,
            createdById: true,
            _count: { select: { matches: true } },
          },
        },
      },
    });

    if (!participant || !canManageTournament(player, participant.tournament)) {
      return { success: false, error: "Participant not found." };
    }
    if (participant.tournament._count.matches > 0) {
      return {
        success: false,
        error: "Participants cannot be removed after the bracket is created.",
      };
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
      return {
        success: false,
        error: "Registration is not open for this tournament.",
      };
    }
    if (
      tournament.scope === BattlegroundsTournamentScope.ALLIANCE &&
      tournament.allianceId !== player.allianceId
    ) {
      return {
        success: false,
        error: "This tournament is limited to its alliance.",
      };
    }

    try {
      await prisma.battlegroundsTournamentParticipant.create({
        data: {
          tournamentId,
          playerId: player.id,
          battlegroup: player.allianceId === tournament.allianceId
            ? player.battlegroup
            : null,
          status: tournament.status === BattlegroundsTournamentStatus.CHECK_IN
            ? TournamentParticipantStatus.CHECKED_IN
            : TournamentParticipantStatus.CONFIRMED,
          checkedInAt: tournament.status === BattlegroundsTournamentStatus.CHECK_IN
            ? new Date()
            : null,
        },
      });
    } catch {
      return {
        success: false,
        error: "You are already in this tournament.",
      };
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
      return {
        success: false,
        error: "Join this tournament before checking in.",
      };
    }
    if (
      participant.tournament.scope === BattlegroundsTournamentScope.ALLIANCE &&
      participant.tournament.allianceId !== player.allianceId
    ) {
      return {
        success: false,
        error: "This tournament is limited to its alliance.",
      };
    }
    if (
      participant.tournament.status !== BattlegroundsTournamentStatus.CHECK_IN
    ) {
      return {
        success: false,
        error: "Check-in is not open for this tournament.",
      };
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

    const result = await generateTournamentBracket(tournament.id);
    if (!result.success) return result;

    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);

export const startTournament = withActionContext(
  "startBattlegroundsTournament",
  async (tournamentId: string): Promise<TournamentActionResult> => {
    const player = await requireTournamentPlanner();
    const tournament = await loadManagedTournamentForMatches(player, tournamentId);
    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }

    const result = await startTournamentBracket(tournament.id);
    if (!result.success) return result;

    revalidatePath(TOURNAMENTS_PATH);
    revalidatePath(`${TOURNAMENTS_PATH}/${tournament.id}`);
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
    const awayParticipantId =
      readTrimmedString(formData, "awayParticipantId") || null;
    const notes = readTrimmedString(formData, "notes");

    if (
      !tournamentId ||
      !homeParticipantId ||
      round === null ||
      matchNumber === null
    ) {
      return {
        success: false,
        error: "Choose a tournament, round, match number, and first player.",
      };
    }
    if (round === undefined || matchNumber === undefined) {
      return {
        success: false,
        error: "Round and match number must be positive whole numbers.",
      };
    }
    if (awayParticipantId === homeParticipantId) {
      return {
        success: false,
        error: "A player cannot face themselves.",
      };
    }

    const tournament = await loadManagedTournamentForMatches(player, tournamentId);
    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }
    if (
      tournament.status === BattlegroundsTournamentStatus.LIVE ||
      tournament.status === BattlegroundsTournamentStatus.FINISHED ||
      tournament.status === BattlegroundsTournamentStatus.ARCHIVED
    ) {
      return {
        success: false,
        error: "Matches cannot be added after the tournament starts.",
      };
    }

    const participantIds = new Set(
      tournament.participants.map((participant) => participant.id)
    );
    if (
      !participantIds.has(homeParticipantId) ||
      (awayParticipantId && !participantIds.has(awayParticipantId))
    ) {
      return {
        success: false,
        error: "Both match players must be in this tournament.",
      };
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
      return {
        success: false,
        error: "A match already exists with that round and match number.",
      };
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
    const requestedWinnerId =
      readTrimmedString(formData, "winnerParticipantId") || null;
    const status = parseMatchStatus(formData.get("status"));
    const notes = readTrimmedString(formData, "notes");

    if (!matchId) {
      return { success: false, error: "Choose a match to report." };
    }
    if (homeScore === undefined || awayScore === undefined) {
      return {
        success: false,
        error: "Scores must be whole numbers or left empty.",
      };
    }
    if (!status) {
      return { success: false, error: "Choose a valid match status." };
    }

    const manageableMatch = await prisma.battlegroundsTournamentMatch.findUnique({
      where: { id: matchId },
      select: {
        tournament: {
          select: {
            id: true,
            allianceId: true,
            createdById: true,
          },
        },
      },
    });

    if (
      !manageableMatch ||
      !canManageTournament(player, manageableMatch.tournament)
    ) {
      return { success: false, error: "Match not found." };
    }

    const result = await reportTournamentMatchResult({
      matchId,
      homeScore,
      awayScore,
      requestedWinnerId,
      status,
      notes: notes || null,
    });
    if (!result.success) return result;

    revalidatePath(TOURNAMENTS_PATH);
    revalidatePath(`${TOURNAMENTS_PATH}/${manageableMatch.tournament.id}`);
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
            status: true,
          },
        },
      },
    });

    if (!match || !canManageTournament(player, match.tournament)) {
      return { success: false, error: "Match not found." };
    }
    if (
      match.tournament.status === BattlegroundsTournamentStatus.LIVE ||
      match.tournament.status === BattlegroundsTournamentStatus.FINISHED ||
      match.tournament.status === BattlegroundsTournamentStatus.ARCHIVED
    ) {
      return {
        success: false,
        error: "Live tournament matches cannot be deleted.",
      };
    }

    await prisma.battlegroundsTournamentMatch.delete({
      where: { id: matchId },
    });
    revalidatePath(TOURNAMENTS_PATH);
    return { success: true };
  }
);
