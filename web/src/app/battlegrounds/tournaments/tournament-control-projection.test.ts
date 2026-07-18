import {
  BattlegroundsMatchBracket,
  BattlegroundsMatchStatus,
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentScope,
  BattlegroundsTournamentStatus,
  TournamentParticipantStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { projectTournamentControl } from "./tournament-control-projection";

const players = [
  { id: "player_1", ingameName: "Alpha", allianceId: "a1", battlegroup: 1, championPrestige: 10, avatar: null },
  { id: "player_2", ingameName: "Beta", allianceId: "a1", battlegroup: 2, championPrestige: 20, avatar: null },
  { id: "player_3", ingameName: "Gamma", allianceId: "a1", battlegroup: 3, championPrestige: 30, avatar: null },
];

const participants = [
  { id: "p3", seed: 3, battlegroup: 3, status: TournamentParticipantStatus.CHECKED_IN, checkedInAt: null, player: players[2] },
  { id: "p1", seed: 1, battlegroup: 1, status: TournamentParticipantStatus.CHECKED_IN, checkedInAt: null, player: players[0] },
  { id: "p2", seed: 2, battlegroup: 2, status: TournamentParticipantStatus.CHECKED_IN, checkedInAt: null, player: players[1] },
];

function match(overrides: Record<string, unknown>) {
  return {
    id: "m1",
    bracket: BattlegroundsMatchBracket.WINNERS,
    round: 1,
    matchNumber: 1,
    status: BattlegroundsMatchStatus.READY,
    homeParticipantId: null,
    awayParticipantId: null,
    winnerParticipantId: null,
    homeScore: null,
    awayScore: null,
    scheduledAt: null,
    notes: null,
    homeParticipant: null,
    awayParticipant: null,
    winnerParticipant: null,
    ...overrides,
  };
}

describe("Tournament Control Projection", () => {
  it("concentrates ordering, standings, bracket state, guidance, and viewer capabilities", () => {
    const tournament = {
      id: "t1",
      name: "Friday bracket",
      description: null,
      scope: BattlegroundsTournamentScope.ALLIANCE,
      format: BattlegroundsTournamentFormat.SINGLE_ELIMINATION,
      status: BattlegroundsTournamentStatus.LIVE,
      startsAt: null,
      checkInStartsAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      allianceId: "a1",
      createdById: "player_1",
      createdBy: { ingameName: "Alpha" },
      participants,
      matches: [
        match({
          id: "m1",
          status: BattlegroundsMatchStatus.FINAL,
          homeParticipantId: "p1",
          awayParticipantId: "p3",
          winnerParticipantId: "p1",
          homeScore: 2,
          awayScore: 0,
          homeParticipant: participants[1],
          awayParticipant: participants[0],
          winnerParticipant: participants[1],
        }),
        match({ id: "m2", matchNumber: 2, homeParticipantId: "p2", homeParticipant: participants[2] }),
        match({ id: "m3", round: 2, homeParticipantId: "p1", homeParticipant: participants[1] }),
      ],
      _count: { matches: 3 },
    };

    const projection = projectTournamentControl({
      tournament,
      players,
      currentPlayerId: "player_1",
      canManage: true,
    });

    expect(projection.tournament.participants.map((entry) => entry.id)).toEqual(["p1", "p2", "p3"]);
    expect(projection.standings[0]).toEqual(expect.objectContaining({ participantId: "p1", wins: 1 }));
    expect(projection.tournament.matches.find((entry) => entry.id === "m3")?.waitingForOpponent).toBe(true);
    expect(projection.summonerGuidance.text).toContain("1 bye");
    expect(projection.viewer).toEqual(expect.objectContaining({
      canManage: true,
      canReportResults: true,
      canEditField: false,
      canJoin: false,
    }));
  });
});
