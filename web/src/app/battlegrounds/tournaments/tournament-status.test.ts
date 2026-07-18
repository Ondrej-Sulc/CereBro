import {
  BattlegroundsMatchBracket,
  BattlegroundsMatchStatus,
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  evaluateTournamentStatus,
  validateTournamentStatusTransition,
} from "./tournament-status";

function snapshot(overrides: Partial<Parameters<typeof evaluateTournamentStatus>[0]> = {}) {
  return {
    format: BattlegroundsTournamentFormat.SINGLE_ELIMINATION,
    status: BattlegroundsTournamentStatus.CHECK_IN,
    participantCount: 4,
    matches: [],
    ...overrides,
  };
}

describe("Battlegrounds Tournament status", () => {
  it("exposes the valid organizer capabilities for check-in", () => {
    expect(evaluateTournamentStatus(snapshot())).toEqual(expect.objectContaining({
      championParticipantId: null,
      isComplete: false,
      nextStatus: null,
      registrationOpen: true,
      checkInOpen: true,
      canStart: true,
      canEditField: true,
      canReportResults: false,
      canEditManualMatches: false,
    }));
  });

  it("identifies a completed single-elimination champion", () => {
    const evaluation = evaluateTournamentStatus(snapshot({
      status: BattlegroundsTournamentStatus.LIVE,
      matches: [{
        bracket: BattlegroundsMatchBracket.WINNERS,
        round: 2,
        matchNumber: 1,
        status: BattlegroundsMatchStatus.FINAL,
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        winnerParticipantId: "p1",
      }],
    }));

    expect(evaluation.championParticipantId).toBe("p1");
    expect(evaluation.isComplete).toBe(true);
    expect(evaluation.nextStatus).toBe(BattlegroundsTournamentStatus.FINISHED);
  });

  it("requires a reset final when the lower-bracket finalist wins grand final one", () => {
    const evaluation = evaluateTournamentStatus(snapshot({
      format: BattlegroundsTournamentFormat.DOUBLE_ELIMINATION,
      status: BattlegroundsTournamentStatus.LIVE,
      matches: [{
        bracket: BattlegroundsMatchBracket.GRAND_FINAL,
        round: 1,
        matchNumber: 1,
        status: BattlegroundsMatchStatus.FINAL,
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        winnerParticipantId: "p2",
      }],
    }));

    expect(evaluation.championParticipantId).toBeNull();
    expect(evaluation.isComplete).toBe(false);
    expect(evaluation.nextStatus).toBeNull();
  });

  it("accepts the reset-final winner as double-elimination champion", () => {
    const evaluation = evaluateTournamentStatus(snapshot({
      format: BattlegroundsTournamentFormat.DOUBLE_ELIMINATION,
      status: BattlegroundsTournamentStatus.LIVE,
      matches: [{
        bracket: BattlegroundsMatchBracket.GRAND_FINAL,
        round: 2,
        matchNumber: 1,
        status: BattlegroundsMatchStatus.FINAL,
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        winnerParticipantId: "p2",
      }],
    }));

    expect(evaluation.championParticipantId).toBe("p2");
    expect(evaluation.isComplete).toBe(true);
  });

  it("returns the championship error instead of a generic transition error", () => {
    expect(validateTournamentStatusTransition(
      snapshot({ status: BattlegroundsTournamentStatus.LIVE }),
      BattlegroundsTournamentStatus.FINISHED
    )).toEqual({
      allowed: false,
      error: "Finish the championship fight before closing the tournament.",
    });
  });
});
