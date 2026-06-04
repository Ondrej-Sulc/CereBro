'use server';

import {
  BattlegroundsTournamentFormat,
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
