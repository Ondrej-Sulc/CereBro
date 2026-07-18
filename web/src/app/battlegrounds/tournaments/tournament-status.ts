import {
  BattlegroundsMatchBracket,
  BattlegroundsMatchStatus,
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentStatus,
} from "@prisma/client";

export type TournamentStatusMatch = {
  bracket: BattlegroundsMatchBracket;
  round: number;
  matchNumber: number;
  status: BattlegroundsMatchStatus;
  homeParticipantId: string | null;
  awayParticipantId: string | null;
  winnerParticipantId: string | null;
};

export type TournamentStatusSnapshot = {
  format: BattlegroundsTournamentFormat;
  status: BattlegroundsTournamentStatus;
  participantCount: number;
  matches: TournamentStatusMatch[];
};

export type TournamentStatusEvaluation = {
  championParticipantId: string | null;
  isComplete: boolean;
  nextStatus: BattlegroundsTournamentStatus | null;
  registrationOpen: boolean;
  checkInOpen: boolean;
  canStart: boolean;
  canEditField: boolean;
  canReportResults: boolean;
  canEditManualMatches: boolean;
};

function championParticipantId(snapshot: TournamentStatusSnapshot) {
  if (snapshot.format === BattlegroundsTournamentFormat.SINGLE_ELIMINATION) {
    const winnerMatches = snapshot.matches.filter(
      (match) => match.bracket === BattlegroundsMatchBracket.WINNERS
    );
    const finalRound = Math.max(0, ...winnerMatches.map((match) => match.round));
    const championshipMatches = winnerMatches.filter(
      (match) => match.round === finalRound
    );
    return championshipMatches.length === 1 &&
      championshipMatches[0].status === BattlegroundsMatchStatus.FINAL
      ? championshipMatches[0].winnerParticipantId
      : null;
  }

  if (snapshot.format === BattlegroundsTournamentFormat.DOUBLE_ELIMINATION) {
    const latestGrandFinal = snapshot.matches
      .filter((match) => match.bracket === BattlegroundsMatchBracket.GRAND_FINAL)
      .sort((a, b) => b.round - a.round || b.matchNumber - a.matchNumber)[0];

    if (
      latestGrandFinal?.status !== BattlegroundsMatchStatus.FINAL ||
      !latestGrandFinal.winnerParticipantId ||
      (
        latestGrandFinal.round === 1 &&
        latestGrandFinal.winnerParticipantId !== latestGrandFinal.homeParticipantId
      )
    ) {
      return null;
    }

    return latestGrandFinal.winnerParticipantId;
  }

  return null;
}

function supportedEliminationFormat(format: BattlegroundsTournamentFormat) {
  return format === BattlegroundsTournamentFormat.SINGLE_ELIMINATION ||
    format === BattlegroundsTournamentFormat.DOUBLE_ELIMINATION;
}

export function evaluateTournamentStatus(
  snapshot: TournamentStatusSnapshot
): TournamentStatusEvaluation {
  const championId = championParticipantId(snapshot);
  const isComplete = championId !== null;
  const matchCount = snapshot.matches.length;
  const preLive = snapshot.status === BattlegroundsTournamentStatus.DRAFT ||
    snapshot.status === BattlegroundsTournamentStatus.REGISTRATION ||
    snapshot.status === BattlegroundsTournamentStatus.CHECK_IN;

  let nextStatus: BattlegroundsTournamentStatus | null = null;
  if (snapshot.status === BattlegroundsTournamentStatus.DRAFT) {
    nextStatus = BattlegroundsTournamentStatus.REGISTRATION;
  } else if (snapshot.status === BattlegroundsTournamentStatus.REGISTRATION) {
    nextStatus = BattlegroundsTournamentStatus.CHECK_IN;
  } else if (snapshot.status === BattlegroundsTournamentStatus.LIVE && isComplete) {
    nextStatus = BattlegroundsTournamentStatus.FINISHED;
  } else if (snapshot.status === BattlegroundsTournamentStatus.FINISHED) {
    nextStatus = BattlegroundsTournamentStatus.ARCHIVED;
  }

  return {
    championParticipantId: championId,
    isComplete,
    nextStatus,
    registrationOpen: snapshot.status === BattlegroundsTournamentStatus.REGISTRATION ||
      snapshot.status === BattlegroundsTournamentStatus.CHECK_IN,
    checkInOpen: snapshot.status === BattlegroundsTournamentStatus.CHECK_IN,
    canStart: supportedEliminationFormat(snapshot.format) &&
      snapshot.status === BattlegroundsTournamentStatus.CHECK_IN &&
      snapshot.participantCount >= 2 &&
      matchCount === 0,
    canEditField: preLive && matchCount === 0,
    canReportResults: snapshot.status === BattlegroundsTournamentStatus.LIVE,
    canEditManualMatches: !supportedEliminationFormat(snapshot.format) && preLive,
  };
}

export function validateTournamentStatusTransition(
  snapshot: TournamentStatusSnapshot,
  requestedStatus: BattlegroundsTournamentStatus
): { allowed: true } | { allowed: false; error: string } {
  const evaluation = evaluateTournamentStatus(snapshot);

  if (
    snapshot.status === BattlegroundsTournamentStatus.LIVE &&
    requestedStatus === BattlegroundsTournamentStatus.FINISHED &&
    !evaluation.isComplete
  ) {
    return {
      allowed: false,
      error: "Finish the championship fight before closing the tournament.",
    };
  }

  if (evaluation.nextStatus !== requestedStatus) {
    return {
      allowed: false,
      error: "Tournament status must move to the next phase.",
    };
  }

  return { allowed: true };
}
