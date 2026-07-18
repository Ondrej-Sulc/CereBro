import {
  BattlegroundsMatchBracket,
  BattlegroundsMatchStatus,
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateTournamentStatus } from "./tournament-status";

export type BracketOperationResult =
  | { success: true }
  | { success: false; error: string };

export type ReportTournamentMatchResultInput = {
  matchId: string;
  homeScore: number | null;
  awayScore: number | null;
  requestedWinnerId: string | null;
  status: BattlegroundsMatchStatus;
  notes: string | null;
};

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

function isSerializableTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function runBracketOperation<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !isSerializableTransactionConflict(error) ||
        attempt === SERIALIZABLE_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  throw new Error("Serializable tournament transaction retry limit reached.");
}

async function loadTournamentForMatches(
  tx: Prisma.TransactionClient,
  tournamentId: string
) {
  return tx.battlegroundsTournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      format: true,
      status: true,
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
          bracket: true,
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
          { bracket: "asc" },
          { round: "asc" },
          { matchNumber: "asc" },
        ],
      },
    },
  });
}

type TournamentForMatches = Awaited<ReturnType<typeof loadTournamentForMatches>>;

function sortedEntrants(tournament: NonNullable<TournamentForMatches>) {
  return [...tournament.participants].sort((a, b) => {
    const aSeed = a.seed ?? 9999;
    const bSeed = b.seed ?? 9999;
    if (aSeed !== bSeed) return aSeed - bSeed;
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

function nextPowerOfTwo(value: number) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function singleEliminationFirstRoundPairs(participantIds: string[]) {
  const bracketSize = nextPowerOfTwo(participantIds.length);
  const byeCount = bracketSize - participantIds.length;

  if (byeCount === 0) return pairHighLow(participantIds);

  const byes = participantIds.slice(0, byeCount);
  const contenders = participantIds.slice(byeCount);
  const contenderPairs = pairHighLow(contenders);
  const slotCount = bracketSize / 2;
  const pairs: Array<[string, string | null]> = [];

  for (let slot = 0; slot < slotCount; slot += 1) {
    if (slot === 0 && byes.length > 0) {
      pairs.push([byes.shift()!, null]);
    } else if (contenderPairs.length > 0) {
      pairs.push(contenderPairs.shift()!);
    } else if (byes.length > 0) {
      pairs.push([byes.shift()!, null]);
    }
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
  const pairs: Array<{
    round: number;
    homeParticipantId: string;
    awayParticipantId: string | null;
  }> = [];

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

function supportsAutomaticGeneration(format: BattlegroundsTournamentFormat) {
  return format === BattlegroundsTournamentFormat.SINGLE_ELIMINATION ||
    format === BattlegroundsTournamentFormat.DOUBLE_ELIMINATION ||
    format === BattlegroundsTournamentFormat.ROUND_ROBIN;
}

function singleEliminationPairs(
  tournament: NonNullable<TournamentForMatches>,
  round: number
) {
  if (round === 1) {
    return {
      pairs: singleEliminationFirstRoundPairs(
        sortedEntrants(tournament).map((entrant) => entrant.id)
      ),
    };
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

  if (seededIds.length < 2) {
    return { error: "Add at least two participants before generating matches." };
  }

  if (!supportsAutomaticGeneration(tournament.format)) {
    return {
      error: "Automatic generation is only available for single elimination, double elimination, and round robin. Add pairings manually for this format.",
    };
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

  if (tournament.format === BattlegroundsTournamentFormat.DOUBLE_ELIMINATION) {
    if (tournament.matches.length > 0) {
      return {
        error: "Double elimination bracket already exists. Record fight results to advance the bracket.",
      };
    }

    return {
      matches: singleEliminationFirstRoundPairs(seededIds).map(
        ([homeParticipantId, awayParticipantId], index) => ({
          tournamentId: tournament.id,
          bracket: BattlegroundsMatchBracket.WINNERS,
          round: 1,
          matchNumber: index + 1,
          homeParticipantId,
          awayParticipantId,
          status: BattlegroundsMatchStatus.READY,
        })
      ),
    };
  }

  const round = nextRound(tournament);
  const generatedPairs = singleEliminationPairs(tournament, round);

  if ("error" in generatedPairs) {
    return { error: generatedPairs.error };
  }

  return {
    matches: generatedPairs.pairs.map(
      ([homeParticipantId, awayParticipantId], index) => ({
        tournamentId: tournament.id,
        round,
        matchNumber: index + 1,
        homeParticipantId,
        awayParticipantId,
        status: BattlegroundsMatchStatus.READY,
      })
    ),
  };
}

async function advanceSingleEliminationWinner(
  tx: Prisma.TransactionClient,
  match: {
    round: number;
    matchNumber: number;
    tournament: {
      id: string;
      format: BattlegroundsTournamentFormat;
    };
  },
  winnerParticipantId: string | null
) {
  if (
    !winnerParticipantId ||
    match.tournament.format !== BattlegroundsTournamentFormat.SINGLE_ELIMINATION
  ) {
    return;
  }

  const currentRoundMatchCount = await tx.battlegroundsTournamentMatch.count({
    where: {
      tournamentId: match.tournament.id,
      round: match.round,
    },
  });

  if (currentRoundMatchCount <= 1) return;

  const nextRoundNumber = match.round + 1;
  const nextMatchNumber = Math.ceil(match.matchNumber / 2);
  const participantField = match.matchNumber % 2 === 1
    ? "homeParticipantId"
    : "awayParticipantId";
  const nextMatch = await tx.battlegroundsTournamentMatch.findFirst({
    where: {
      tournamentId: match.tournament.id,
      round: nextRoundNumber,
      matchNumber: nextMatchNumber,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (nextMatch) {
    if (nextMatch.status === BattlegroundsMatchStatus.FINAL) return;

    await tx.battlegroundsTournamentMatch.update({
      where: { id: nextMatch.id },
      data: {
        [participantField]: winnerParticipantId,
        status: BattlegroundsMatchStatus.READY,
        homeScore: null,
        awayScore: null,
        winnerParticipantId: null,
      },
    });
    return;
  }

  await tx.battlegroundsTournamentMatch.create({
    data: {
      tournamentId: match.tournament.id,
      round: nextRoundNumber,
      matchNumber: nextMatchNumber,
      [participantField]: winnerParticipantId,
      status: BattlegroundsMatchStatus.READY,
    },
  });
}

async function placeGeneratedParticipant({
  tx,
  tournamentId,
  bracket,
  round,
  matchNumber,
  participantField,
  participantId,
}: {
  tx: Prisma.TransactionClient;
  tournamentId: string;
  bracket: BattlegroundsMatchBracket;
  round: number;
  matchNumber: number;
  participantField: "homeParticipantId" | "awayParticipantId";
  participantId: string | null;
}) {
  if (!participantId) return;

  const existingMatch = await tx.battlegroundsTournamentMatch.findFirst({
    where: {
      tournamentId,
      bracket,
      round,
      matchNumber,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingMatch) {
    if (existingMatch.status === BattlegroundsMatchStatus.FINAL) return;

    await tx.battlegroundsTournamentMatch.update({
      where: { id: existingMatch.id },
      data: {
        [participantField]: participantId,
        status: BattlegroundsMatchStatus.READY,
        homeScore: null,
        awayScore: null,
        winnerParticipantId: null,
      },
    });
    return;
  }

  await tx.battlegroundsTournamentMatch.create({
    data: {
      tournamentId,
      bracket,
      round,
      matchNumber,
      [participantField]: participantId,
      status: BattlegroundsMatchStatus.READY,
    },
  });
}

function matchLoserParticipantId(
  match: {
    homeParticipantId: string | null;
    awayParticipantId: string | null;
  },
  winnerParticipantId: string | null
) {
  if (!winnerParticipantId) return null;
  if (match.homeParticipantId === winnerParticipantId) return match.awayParticipantId;
  if (match.awayParticipantId === winnerParticipantId) return match.homeParticipantId;
  return null;
}

async function doubleEliminationWinnerRoundCount(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  round: number
) {
  return tx.battlegroundsTournamentMatch.count({
    where: {
      tournamentId,
      bracket: BattlegroundsMatchBracket.WINNERS,
      round,
    },
  });
}

async function doubleEliminationLosersFinalRound(
  tx: Prisma.TransactionClient,
  tournamentId: string
) {
  const firstWinnerRoundMatchCount = await doubleEliminationWinnerRoundCount(
    tx,
    tournamentId,
    1
  );
  const bracketSize = Math.max(2, firstWinnerRoundMatchCount * 2);
  const winnerRoundCount = Math.ceil(Math.log2(bracketSize));
  return Math.max(1, 2 * (winnerRoundCount - 1));
}

async function advanceDoubleEliminationResult(
  tx: Prisma.TransactionClient,
  match: {
    bracket: BattlegroundsMatchBracket;
    round: number;
    matchNumber: number;
    homeParticipantId: string | null;
    awayParticipantId: string | null;
    tournament: {
      id: string;
      format: BattlegroundsTournamentFormat;
    };
  },
  winnerParticipantId: string | null
) {
  if (
    !winnerParticipantId ||
    match.tournament.format !== BattlegroundsTournamentFormat.DOUBLE_ELIMINATION
  ) {
    return;
  }

  const tournamentId = match.tournament.id;

  if (match.bracket === BattlegroundsMatchBracket.GRAND_FINAL) {
    if (
      match.round === 1 &&
      match.homeParticipantId &&
      match.awayParticipantId &&
      winnerParticipantId === match.awayParticipantId
    ) {
      await placeGeneratedParticipant({
        tx,
        tournamentId,
        bracket: BattlegroundsMatchBracket.GRAND_FINAL,
        round: 2,
        matchNumber: 1,
        participantField: "homeParticipantId",
        participantId: match.homeParticipantId,
      });
      await placeGeneratedParticipant({
        tx,
        tournamentId,
        bracket: BattlegroundsMatchBracket.GRAND_FINAL,
        round: 2,
        matchNumber: 1,
        participantField: "awayParticipantId",
        participantId: match.awayParticipantId,
      });
    } else if (
      match.round === 1 &&
      winnerParticipantId === match.homeParticipantId
    ) {
      await tx.battlegroundsTournamentMatch.deleteMany({
        where: {
          tournamentId,
          bracket: BattlegroundsMatchBracket.GRAND_FINAL,
          round: 2,
          matchNumber: 1,
          status: { not: BattlegroundsMatchStatus.FINAL },
        },
      });
    }
    return;
  }

  if (match.bracket === BattlegroundsMatchBracket.WINNERS) {
    const currentRoundMatchCount = await doubleEliminationWinnerRoundCount(
      tx,
      tournamentId,
      match.round
    );
    if (currentRoundMatchCount > 1) {
      await placeGeneratedParticipant({
        tx,
        tournamentId,
        bracket: BattlegroundsMatchBracket.WINNERS,
        round: match.round + 1,
        matchNumber: Math.ceil(match.matchNumber / 2),
        participantField: match.matchNumber % 2 === 1
          ? "homeParticipantId"
          : "awayParticipantId",
        participantId: winnerParticipantId,
      });
    } else {
      await placeGeneratedParticipant({
        tx,
        tournamentId,
        bracket: BattlegroundsMatchBracket.GRAND_FINAL,
        round: 1,
        matchNumber: 1,
        participantField: "homeParticipantId",
        participantId: winnerParticipantId,
      });
    }

    const loserParticipantId = matchLoserParticipantId(match, winnerParticipantId);
    if (!loserParticipantId) return;

    const loserRound = match.round === 1 ? 1 : 2 * match.round - 2;
    await placeGeneratedParticipant({
      tx,
      tournamentId,
      bracket: BattlegroundsMatchBracket.LOSERS,
      round: loserRound,
      matchNumber: match.round === 1
        ? Math.ceil(match.matchNumber / 2)
        : match.matchNumber,
      participantField: match.round === 1 && match.matchNumber % 2 === 1
        ? "homeParticipantId"
        : "awayParticipantId",
      participantId: loserParticipantId,
    });
    return;
  }

  if (match.bracket === BattlegroundsMatchBracket.LOSERS) {
    const finalLosersRound = await doubleEliminationLosersFinalRound(tx, tournamentId);
    if (match.round >= finalLosersRound) {
      await placeGeneratedParticipant({
        tx,
        tournamentId,
        bracket: BattlegroundsMatchBracket.GRAND_FINAL,
        round: 1,
        matchNumber: 1,
        participantField: "awayParticipantId",
        participantId: winnerParticipantId,
      });
      return;
    }

    await placeGeneratedParticipant({
      tx,
      tournamentId,
      bracket: BattlegroundsMatchBracket.LOSERS,
      round: match.round + 1,
      matchNumber: match.round % 2 === 1
        ? match.matchNumber
        : Math.ceil(match.matchNumber / 2),
      participantField: match.round % 2 === 1
        ? "homeParticipantId"
        : match.matchNumber % 2 === 1
          ? "homeParticipantId"
          : "awayParticipantId",
      participantId: winnerParticipantId,
    });
  }
}

async function hasFinalDownstreamSingleEliminationMatch(
  tx: Prisma.TransactionClient,
  match: {
    round: number;
    matchNumber: number;
    tournament: {
      id: string;
      format: BattlegroundsTournamentFormat;
    };
  }
) {
  if (match.tournament.format !== BattlegroundsTournamentFormat.SINGLE_ELIMINATION) {
    return false;
  }

  const downstreamMatch = await tx.battlegroundsTournamentMatch.findFirst({
    where: {
      tournamentId: match.tournament.id,
      round: match.round + 1,
      matchNumber: Math.ceil(match.matchNumber / 2),
      status: BattlegroundsMatchStatus.FINAL,
    },
    select: { id: true },
  });

  return !!downstreamMatch;
}

async function hasFinalGeneratedMatch({
  tx,
  tournamentId,
  bracket,
  round,
  matchNumber,
}: {
  tx: Prisma.TransactionClient;
  tournamentId: string;
  bracket: BattlegroundsMatchBracket;
  round: number;
  matchNumber: number;
}) {
  const downstreamMatch = await tx.battlegroundsTournamentMatch.findFirst({
    where: {
      tournamentId,
      bracket,
      round,
      matchNumber,
      status: BattlegroundsMatchStatus.FINAL,
    },
    select: { id: true },
  });

  return !!downstreamMatch;
}

async function hasFinalDownstreamDoubleEliminationMatch(
  tx: Prisma.TransactionClient,
  match: {
    bracket: BattlegroundsMatchBracket;
    round: number;
    matchNumber: number;
    tournament: {
      id: string;
      format: BattlegroundsTournamentFormat;
    };
  }
) {
  if (match.tournament.format !== BattlegroundsTournamentFormat.DOUBLE_ELIMINATION) {
    return false;
  }

  const tournamentId = match.tournament.id;

  if (match.bracket === BattlegroundsMatchBracket.WINNERS) {
    const currentRoundMatchCount = await doubleEliminationWinnerRoundCount(
      tx,
      tournamentId,
      match.round
    );
    const winnerDestination = currentRoundMatchCount > 1
      ? {
          bracket: BattlegroundsMatchBracket.WINNERS,
          round: match.round + 1,
          matchNumber: Math.ceil(match.matchNumber / 2),
        }
      : {
          bracket: BattlegroundsMatchBracket.GRAND_FINAL,
          round: 1,
          matchNumber: 1,
        };
    const loserDestination = {
      bracket: BattlegroundsMatchBracket.LOSERS,
      round: match.round === 1 ? 1 : 2 * match.round - 2,
      matchNumber: match.round === 1
        ? Math.ceil(match.matchNumber / 2)
        : match.matchNumber,
    };

    return await hasFinalGeneratedMatch({
      tx,
      tournamentId,
      ...winnerDestination,
    }) || await hasFinalGeneratedMatch({
      tx,
      tournamentId,
      ...loserDestination,
    });
  }

  if (match.bracket === BattlegroundsMatchBracket.LOSERS) {
    const finalLosersRound = await doubleEliminationLosersFinalRound(tx, tournamentId);
    const downstreamDestination = match.round >= finalLosersRound
      ? {
          bracket: BattlegroundsMatchBracket.GRAND_FINAL,
          round: 1,
          matchNumber: 1,
        }
      : {
          bracket: BattlegroundsMatchBracket.LOSERS,
          round: match.round + 1,
          matchNumber: match.round % 2 === 1
            ? match.matchNumber
            : Math.ceil(match.matchNumber / 2),
        };

    return hasFinalGeneratedMatch({
      tx,
      tournamentId,
      ...downstreamDestination,
    });
  }

  if (
    match.bracket === BattlegroundsMatchBracket.GRAND_FINAL &&
    match.round === 1
  ) {
    return hasFinalGeneratedMatch({
      tx,
      tournamentId,
      bracket: BattlegroundsMatchBracket.GRAND_FINAL,
      round: 2,
      matchNumber: 1,
    });
  }

  return false;
}

async function autoAdvanceInitialByes(
  tx: Prisma.TransactionClient,
  tournamentId: string
) {
  const byeMatches = await tx.battlegroundsTournamentMatch.findMany({
    where: {
      tournamentId,
      awayParticipantId: null,
      winnerParticipantId: null,
    },
    select: {
      id: true,
      bracket: true,
      round: true,
      matchNumber: true,
      awayParticipantId: true,
      homeParticipantId: true,
      tournament: {
        select: {
          id: true,
          format: true,
        },
      },
    },
    orderBy: [
      { round: "asc" },
      { matchNumber: "asc" },
    ],
  });

  for (const match of byeMatches) {
    if (!match.homeParticipantId) continue;

    await tx.battlegroundsTournamentMatch.update({
      where: { id: match.id },
      data: {
        status: BattlegroundsMatchStatus.FINAL,
        winnerParticipantId: match.homeParticipantId,
      },
    });

    await advanceSingleEliminationWinner(tx, match, match.homeParticipantId);
    await advanceDoubleEliminationResult(tx, match, match.homeParticipantId);
  }
}

function doubleEliminationByeSources(match: {
  bracket: BattlegroundsMatchBracket;
  round: number;
  matchNumber: number;
}) {
  if (match.bracket === BattlegroundsMatchBracket.WINNERS) {
    if (match.round === 1) return [];
    return [
      {
        bracket: BattlegroundsMatchBracket.WINNERS,
        round: match.round - 1,
        matchNumber: match.matchNumber * 2 - 1,
      },
      {
        bracket: BattlegroundsMatchBracket.WINNERS,
        round: match.round - 1,
        matchNumber: match.matchNumber * 2,
      },
    ];
  }

  if (match.bracket === BattlegroundsMatchBracket.LOSERS) {
    if (match.round === 1) {
      return [
        {
          bracket: BattlegroundsMatchBracket.WINNERS,
          round: 1,
          matchNumber: match.matchNumber * 2 - 1,
        },
        {
          bracket: BattlegroundsMatchBracket.WINNERS,
          round: 1,
          matchNumber: match.matchNumber * 2,
        },
      ];
    }

    if (match.round % 2 === 0) {
      return [
        {
          bracket: BattlegroundsMatchBracket.LOSERS,
          round: match.round - 1,
          matchNumber: match.matchNumber,
        },
        {
          bracket: BattlegroundsMatchBracket.WINNERS,
          round: match.round / 2 + 1,
          matchNumber: match.matchNumber,
        },
      ];
    }

    return [
      {
        bracket: BattlegroundsMatchBracket.LOSERS,
        round: match.round - 1,
        matchNumber: match.matchNumber * 2 - 1,
      },
      {
        bracket: BattlegroundsMatchBracket.LOSERS,
        round: match.round - 1,
        matchNumber: match.matchNumber * 2,
      },
    ];
  }

  return null;
}

function sourceMatchIsFinal(
  matches: Array<{
    bracket: BattlegroundsMatchBracket;
    round: number;
    matchNumber: number;
    status: BattlegroundsMatchStatus;
  }>,
  source: {
    bracket: BattlegroundsMatchBracket;
    round: number;
    matchNumber: number;
  }
) {
  const sourceMatch = matches.find((match) => (
    match.bracket === source.bracket &&
    match.round === source.round &&
    match.matchNumber === source.matchNumber
  ));
  if (sourceMatch) return sourceMatch.status === BattlegroundsMatchStatus.FINAL;

  const sourceRoundMatchCount = matches.filter((match) => (
    match.bracket === source.bracket &&
    match.round === source.round
  )).length;
  return sourceRoundMatchCount > 0 && source.matchNumber > sourceRoundMatchCount;
}

async function autoAdvanceResolvableDoubleEliminationByes(
  tx: Prisma.TransactionClient,
  tournamentId: string
) {
  const matches = await tx.battlegroundsTournamentMatch.findMany({
    where: { tournamentId },
    select: {
      id: true,
      bracket: true,
      round: true,
      matchNumber: true,
      status: true,
      homeParticipantId: true,
      awayParticipantId: true,
      winnerParticipantId: true,
      tournament: {
        select: {
          id: true,
          format: true,
        },
      },
    },
    orderBy: [
      { bracket: "asc" },
      { round: "asc" },
      { matchNumber: "asc" },
    ],
  });

  for (const match of matches) {
    if (
      match.tournament.format !== BattlegroundsTournamentFormat.DOUBLE_ELIMINATION ||
      match.winnerParticipantId
    ) {
      continue;
    }

    const loneParticipantId = match.homeParticipantId ?? match.awayParticipantId;
    if (
      !loneParticipantId ||
      (match.homeParticipantId && match.awayParticipantId)
    ) {
      continue;
    }

    const sources = doubleEliminationByeSources(match);
    if (sources === null) continue;
    if (!sources.every((source) => sourceMatchIsFinal(matches, source))) continue;

    const normalizedMatch = {
      ...match,
      homeParticipantId: loneParticipantId,
      awayParticipantId: null,
    };

    await tx.battlegroundsTournamentMatch.update({
      where: { id: match.id },
      data: {
        homeParticipantId: loneParticipantId,
        awayParticipantId: null,
        status: BattlegroundsMatchStatus.FINAL,
        winnerParticipantId: loneParticipantId,
      },
    });

    await advanceDoubleEliminationResult(tx, normalizedMatch, loneParticipantId);
  }
}

export function generateTournamentBracket(
  tournamentId: string
): Promise<BracketOperationResult> {
  return runBracketOperation(async (tx) => {
    const tournament = await loadTournamentForMatches(tx, tournamentId);
    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }

    const generated = buildGeneratedMatches(tournament);
    if ("error" in generated) {
      return {
        success: false,
        error: generated.error ?? "Unable to generate matches.",
      };
    }

    try {
      await tx.battlegroundsTournamentMatch.createMany({
        data: generated.matches,
      });
    } catch {
      return {
        success: false,
        error: "Matches already exist for that generated round.",
      };
    }

    return { success: true };
  });
}

export function startTournamentBracket(
  tournamentId: string
): Promise<BracketOperationResult> {
  return runBracketOperation(async (tx) => {
    const tournament = await loadTournamentForMatches(tx, tournamentId);
    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }

    if (
      tournament.format !== BattlegroundsTournamentFormat.SINGLE_ELIMINATION &&
      tournament.format !== BattlegroundsTournamentFormat.DOUBLE_ELIMINATION
    ) {
      return {
        success: false,
        error: "Start is currently automated for single and double elimination tournaments only.",
      };
    }

    const tournamentStatus = evaluateTournamentStatus({
      format: tournament.format,
      status: tournament.status,
      participantCount: tournament.participants.length,
      matches: tournament.matches,
    });
    if (!tournamentStatus.checkInOpen) {
      return {
        success: false,
        error: "Open check-in before starting the tournament.",
      };
    }

    if (tournament.matches.length === 0) {
      const generated = buildGeneratedMatches(tournament);
      if ("error" in generated) {
        return {
          success: false,
          error: generated.error ?? "Unable to start tournament.",
        };
      }

      try {
        await tx.battlegroundsTournamentMatch.createMany({
          data: generated.matches,
        });
      } catch {
        return {
          success: false,
          error: "Matches already exist for that generated round.",
        };
      }
    }

    await autoAdvanceInitialByes(tx, tournament.id);

    await tx.battlegroundsTournament.update({
      where: { id: tournament.id },
      data: { status: BattlegroundsTournamentStatus.LIVE },
    });

    return { success: true };
  });
}

export function reportTournamentMatchResult(
  input: ReportTournamentMatchResultInput
): Promise<BracketOperationResult> {
  return runBracketOperation(async (tx) => {
    const match = await tx.battlegroundsTournamentMatch.findUnique({
      where: { id: input.matchId },
      select: {
        id: true,
        bracket: true,
        round: true,
        matchNumber: true,
        homeParticipantId: true,
        awayParticipantId: true,
        tournament: {
          select: {
            id: true,
            format: true,
            status: true,
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
        },
      },
    });

    if (!match) {
      return { success: false, error: "Match not found." };
    }

    const tournamentStatus = evaluateTournamentStatus({
      format: match.tournament.format,
      status: match.tournament.status ?? BattlegroundsTournamentStatus.LIVE,
      participantCount: match.tournament._count?.participants ?? 0,
      matches: match.tournament.matches ?? [],
    });
    if (!tournamentStatus.canReportResults) {
      return {
        success: false,
        error: "Match results can only be changed while the tournament is live.",
      };
    }

    let winnerParticipantId = input.requestedWinnerId;
    if (
      !winnerParticipantId &&
      input.homeScore !== null &&
      input.awayScore !== null &&
      input.homeScore !== input.awayScore
    ) {
      winnerParticipantId = input.homeScore > input.awayScore
        ? match.homeParticipantId
        : match.awayParticipantId;
    }

    const validWinnerIds = new Set(
      [match.homeParticipantId, match.awayParticipantId].filter(Boolean)
    );
    if (winnerParticipantId && !validWinnerIds.has(winnerParticipantId)) {
      return {
        success: false,
        error: "Winner must be one of the match players.",
      };
    }

    if (
      input.status === BattlegroundsMatchStatus.FINAL &&
      !winnerParticipantId
    ) {
      return { success: false, error: "Final matches need a winner." };
    }

    const isByeMatch = !match.awayParticipantId;
    if (input.status === BattlegroundsMatchStatus.FINAL && !isByeMatch) {
      if (input.homeScore === null || input.awayScore === null) {
        return {
          success: false,
          error: "Final matches need both scores.",
        };
      }

      if (input.homeScore === input.awayScore) {
        return {
          success: false,
          error: "Final matches cannot end tied.",
        };
      }

      const scoreWinnerId = input.homeScore > input.awayScore
        ? match.homeParticipantId
        : match.awayParticipantId;
      if (winnerParticipantId && winnerParticipantId !== scoreWinnerId) {
        return {
          success: false,
          error: "Winner must match the score.",
        };
      }

      winnerParticipantId = scoreWinnerId;
    }

    const hasFinalDownstreamMatch =
      input.status === BattlegroundsMatchStatus.FINAL &&
      (
        await hasFinalDownstreamSingleEliminationMatch(tx, match) ||
        await hasFinalDownstreamDoubleEliminationMatch(tx, match)
      );
    if (hasFinalDownstreamMatch) {
      return {
        success: false,
        error: "Cannot change this result after the next fight is final.",
      };
    }

    await tx.battlegroundsTournamentMatch.update({
      where: { id: input.matchId },
      data: {
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        winnerParticipantId,
        status: input.status,
        notes: input.notes,
      },
    });

    if (input.status === BattlegroundsMatchStatus.FINAL) {
      await advanceSingleEliminationWinner(tx, match, winnerParticipantId);
      await advanceDoubleEliminationResult(tx, match, winnerParticipantId);
      await autoAdvanceResolvableDoubleEliminationByes(tx, match.tournament.id);
    }

    return { success: true };
  });
}
