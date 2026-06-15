import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  battlegroundsTournament: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  battlegroundsTournamentMatch: {
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  battlegroundsTournamentParticipant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const authHelpersFake = vi.hoisted(() => ({
  getUserPlayerWithAlliance: vi.fn(),
}));

const permissionsFake = vi.hoisted(() => ({
  canPlanAllianceWar: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authHelpersFake);
vi.mock("@/lib/alliance-permissions", () => permissionsFake);
vi.mock("@/lib/logger", () => ({ default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => cacheFake);

import {
  checkInTournamentParticipant,
  createTournament,
  generateTournamentMatches,
  recordTournamentMatchResult,
  startTournament,
} from "./actions";

function buildCreateTournamentForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("name", overrides.name ?? "Friday BG Gauntlet");
  formData.set("description", overrides.description ?? "Friendly bracket");
  formData.set("scope", overrides.scope ?? "COMMUNITY");
  formData.set("format", overrides.format ?? "SINGLE_ELIMINATION");
  formData.set("startsAt", overrides.startsAt ?? "2026-06-04T20:00");
  formData.set("startsAtTimezoneOffsetMinutes", overrides.startsAtTimezoneOffsetMinutes ?? "240");
  formData.set("checkInStartsAt", overrides.checkInStartsAt ?? "2026-06-04T19:30");
  formData.set("checkInStartsAtTimezoneOffsetMinutes", overrides.checkInStartsAtTimezoneOffsetMinutes ?? "240");
  return formData;
}

describe("battlegrounds tournament actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHelpersFake.getUserPlayerWithAlliance.mockResolvedValue({
      id: "player_1",
      allianceId: "alliance_1",
      isBotAdmin: false,
      isOfficer: true,
      isPlanner: false,
    });
    permissionsFake.canPlanAllianceWar.mockReturnValue(true);
    prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "tournament_1" });
    prismaFake.battlegroundsTournament.update.mockResolvedValue({ id: "tournament_1" });
    prismaFake.battlegroundsTournamentMatch.count.mockResolvedValue(1);
    prismaFake.battlegroundsTournamentMatch.create.mockResolvedValue({ id: "match_2" });
    prismaFake.battlegroundsTournamentMatch.createMany.mockResolvedValue({ count: 2 });
    prismaFake.battlegroundsTournamentMatch.findFirst.mockResolvedValue(null);
    prismaFake.battlegroundsTournamentMatch.findMany.mockResolvedValue([]);
    prismaFake.battlegroundsTournamentMatch.update.mockResolvedValue({ id: "match_1" });
    prismaFake.battlegroundsTournamentParticipant.update.mockResolvedValue({ id: "participant_1" });
  });

  it("stores datetime-local values using the browser timezone offset", async () => {
    await expect(createTournament(buildCreateTournamentForm())).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        startsAt: new Date("2026-06-05T00:00:00.000Z"),
        checkInStartsAt: new Date("2026-06-04T23:30:00.000Z"),
      }),
    });
  });

  it("generates seeded high-low elimination matches for the first round", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "SINGLE_ELIMINATION",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
        { id: "p3", seed: 3, createdAt: new Date("2026-01-03T00:00:00Z") },
        { id: "p4", seed: 4, createdAt: new Date("2026-01-04T00:00:00Z") },
      ],
      matches: [],
    });

    await expect(generateTournamentMatches("tournament_1")).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          round: 1,
          matchNumber: 1,
          homeParticipantId: "p1",
          awayParticipantId: "p4",
          status: "READY",
        }),
        expect.objectContaining({
          round: 1,
          matchNumber: 2,
          homeParticipantId: "p2",
          awayParticipantId: "p3",
          status: "READY",
        }),
      ],
    });
  });

  it("places top-seed byes in the first single elimination round", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "SINGLE_ELIMINATION",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
        { id: "p3", seed: 3, createdAt: new Date("2026-01-03T00:00:00Z") },
        { id: "p4", seed: 4, createdAt: new Date("2026-01-04T00:00:00Z") },
        { id: "p5", seed: 5, createdAt: new Date("2026-01-05T00:00:00Z") },
        { id: "p6", seed: 6, createdAt: new Date("2026-01-06T00:00:00Z") },
      ],
      matches: [],
    });

    await expect(generateTournamentMatches("tournament_1")).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          round: 1,
          matchNumber: 1,
          homeParticipantId: "p1",
          awayParticipantId: null,
          status: "READY",
        }),
        expect.objectContaining({
          round: 1,
          matchNumber: 2,
          homeParticipantId: "p3",
          awayParticipantId: "p6",
          status: "READY",
        }),
        expect.objectContaining({
          round: 1,
          matchNumber: 3,
          homeParticipantId: "p4",
          awayParticipantId: "p5",
          status: "READY",
        }),
        expect.objectContaining({
          round: 1,
          matchNumber: 4,
          homeParticipantId: "p2",
          awayParticipantId: null,
          status: "READY",
        }),
      ],
    });
  });

  it("starts a single elimination tournament by creating the first round and setting it live", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "SINGLE_ELIMINATION",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
      ],
      matches: [],
    });

    await expect(startTournament("tournament_1")).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          round: 1,
          matchNumber: 1,
          homeParticipantId: "p1",
          awayParticipantId: "p2",
          status: "READY",
        }),
      ],
    });
    expect(prismaFake.battlegroundsTournament.update).toHaveBeenCalledWith({
      where: { id: "tournament_1" },
      data: { status: "LIVE" },
    });
  });

  it("starts a double elimination tournament by creating the winners bracket first round", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "DOUBLE_ELIMINATION",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
        { id: "p3", seed: 3, createdAt: new Date("2026-01-03T00:00:00Z") },
        { id: "p4", seed: 4, createdAt: new Date("2026-01-04T00:00:00Z") },
      ],
      matches: [],
    });

    await expect(startTournament("tournament_1")).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          bracket: "WINNERS",
          round: 1,
          matchNumber: 1,
          homeParticipantId: "p1",
          awayParticipantId: "p4",
          status: "READY",
        }),
        expect.objectContaining({
          bracket: "WINNERS",
          round: 1,
          matchNumber: 2,
          homeParticipantId: "p2",
          awayParticipantId: "p3",
          status: "READY",
        }),
      ],
    });
    expect(prismaFake.battlegroundsTournament.update).toHaveBeenCalledWith({
      where: { id: "tournament_1" },
      data: { status: "LIVE" },
    });
  });

  it("auto-advances first-round byes when starting a single elimination tournament", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "SINGLE_ELIMINATION",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
        { id: "p3", seed: 3, createdAt: new Date("2026-01-03T00:00:00Z") },
        { id: "p4", seed: 4, createdAt: new Date("2026-01-04T00:00:00Z") },
        { id: "p5", seed: 5, createdAt: new Date("2026-01-05T00:00:00Z") },
        { id: "p6", seed: 6, createdAt: new Date("2026-01-06T00:00:00Z") },
      ],
      matches: [],
    });
    prismaFake.battlegroundsTournamentMatch.findMany.mockResolvedValue([
      {
        id: "match_1",
        round: 1,
        matchNumber: 1,
        homeParticipantId: "p1",
        tournament: { id: "tournament_1", format: "SINGLE_ELIMINATION" },
      },
      {
        id: "match_4",
        round: 1,
        matchNumber: 4,
        homeParticipantId: "p2",
        tournament: { id: "tournament_1", format: "SINGLE_ELIMINATION" },
      },
    ]);
    prismaFake.battlegroundsTournamentMatch.count.mockResolvedValue(4);

    await expect(startTournament("tournament_1")).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.update).toHaveBeenCalledWith({
      where: { id: "match_1" },
      data: {
        status: "FINAL",
        winnerParticipantId: "p1",
      },
    });
    expect(prismaFake.battlegroundsTournamentMatch.update).toHaveBeenCalledWith({
      where: { id: "match_4" },
      data: {
        status: "FINAL",
        winnerParticipantId: "p2",
      },
    });
    expect(prismaFake.battlegroundsTournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "tournament_1",
        round: 2,
        matchNumber: 1,
        homeParticipantId: "p1",
        status: "READY",
      }),
    });
    expect(prismaFake.battlegroundsTournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "tournament_1",
        round: 2,
        matchNumber: 2,
        awayParticipantId: "p2",
        status: "READY",
      }),
    });
  });

  it("generates the next single elimination round from previous winners", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "SINGLE_ELIMINATION",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
        { id: "p3", seed: 3, createdAt: new Date("2026-01-03T00:00:00Z") },
        { id: "p4", seed: 4, createdAt: new Date("2026-01-04T00:00:00Z") },
      ],
      matches: [
        {
          id: "match_1",
          round: 1,
          matchNumber: 1,
          homeParticipantId: "p1",
          awayParticipantId: "p4",
          winnerParticipantId: "p4",
          homeScore: 1,
          awayScore: 3,
          status: "FINAL",
        },
        {
          id: "match_2",
          round: 1,
          matchNumber: 2,
          homeParticipantId: "p2",
          awayParticipantId: "p3",
          winnerParticipantId: "p2",
          homeScore: 3,
          awayScore: 0,
          status: "FINAL",
        },
      ],
    });

    await expect(generateTournamentMatches("tournament_1")).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          round: 2,
          matchNumber: 1,
          homeParticipantId: "p4",
          awayParticipantId: "p2",
          status: "READY",
        }),
      ],
    });
  });

  it("does not auto-generate matches for manual pairing formats", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "SWISS",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
      ],
      matches: [],
    });

    await expect(generateTournamentMatches("tournament_1")).resolves.toEqual({
      success: false,
      error: "Automatic generation is only available for single elimination, double elimination, and round robin. Add pairings manually for this format.",
    });

    expect(prismaFake.battlegroundsTournamentMatch.createMany).not.toHaveBeenCalled();
  });

  it("does not generate a single elimination round until the previous round is final", async () => {
    prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
      id: "tournament_1",
      allianceId: "alliance_1",
      createdById: "player_1",
      format: "SINGLE_ELIMINATION",
      participants: [
        { id: "p1", seed: 1, createdAt: new Date("2026-01-01T00:00:00Z") },
        { id: "p2", seed: 2, createdAt: new Date("2026-01-02T00:00:00Z") },
      ],
      matches: [
        {
          id: "match_1",
          round: 1,
          matchNumber: 1,
          homeParticipantId: "p1",
          awayParticipantId: "p2",
          winnerParticipantId: null,
          homeScore: null,
          awayScore: null,
          status: "READY",
        },
      ],
    });

    await expect(generateTournamentMatches("tournament_1")).resolves.toEqual({
      success: false,
      error: "Finish round 1 before generating round 2.",
    });

    expect(prismaFake.battlegroundsTournamentMatch.createMany).not.toHaveBeenCalled();
  });

  it("checks in the current player during check-in", async () => {
    prismaFake.battlegroundsTournamentParticipant.findUnique.mockResolvedValue({
      id: "participant_1",
      status: "CONFIRMED",
      tournament: {
        status: "CHECK_IN",
        scope: "ALLIANCE",
        allianceId: "alliance_1",
      },
    });

    await expect(checkInTournamentParticipant("tournament_1")).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentParticipant.update).toHaveBeenCalledWith({
      where: { id: "participant_1" },
      data: expect.objectContaining({
        status: "CHECKED_IN",
        checkedInAt: expect.any(Date),
      }),
    });
  });

  it("does not check in before the check-in phase", async () => {
    prismaFake.battlegroundsTournamentParticipant.findUnique.mockResolvedValue({
      id: "participant_1",
      status: "CONFIRMED",
      tournament: {
        status: "REGISTRATION",
        scope: "COMMUNITY",
        allianceId: null,
      },
    });

    await expect(checkInTournamentParticipant("tournament_1")).resolves.toEqual({
      success: false,
      error: "Check-in is not open for this tournament.",
    });

    expect(prismaFake.battlegroundsTournamentParticipant.update).not.toHaveBeenCalled();
  });

  it("records a final result and infers the winner from scores", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_1",
      homeParticipantId: "p1",
      awayParticipantId: "p2",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
      },
    });

    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("homeScore", "3");
    formData.set("awayScore", "2");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.update).toHaveBeenCalledWith({
      where: { id: "match_1" },
      data: expect.objectContaining({
        homeScore: 3,
        awayScore: 2,
        winnerParticipantId: "p1",
        status: "FINAL",
      }),
    });
  });

  it("advances a single elimination winner into the next fight slot", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_1",
      round: 1,
      matchNumber: 1,
      homeParticipantId: "p1",
      awayParticipantId: "p4",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
        format: "SINGLE_ELIMINATION",
      },
    });
    prismaFake.battlegroundsTournamentMatch.count.mockResolvedValue(2);
    prismaFake.battlegroundsTournamentMatch.findFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("homeScore", "2");
    formData.set("awayScore", "0");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "tournament_1",
        round: 2,
        matchNumber: 1,
        homeParticipantId: "p1",
        status: "READY",
      }),
    });
  });

  it("advances a double elimination winners bracket result into winners and losers lanes", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_1",
      bracket: "WINNERS",
      round: 1,
      matchNumber: 1,
      homeParticipantId: "p1",
      awayParticipantId: "p4",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
        format: "DOUBLE_ELIMINATION",
      },
    });
    prismaFake.battlegroundsTournamentMatch.count.mockResolvedValue(2);
    prismaFake.battlegroundsTournamentMatch.findFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("homeScore", "2");
    formData.set("awayScore", "0");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "tournament_1",
        bracket: "WINNERS",
        round: 2,
        matchNumber: 1,
        homeParticipantId: "p1",
        status: "READY",
      }),
    });
    expect(prismaFake.battlegroundsTournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "tournament_1",
        bracket: "LOSERS",
        round: 1,
        matchNumber: 1,
        homeParticipantId: "p4",
        status: "READY",
      }),
    });
  });

  it("advances a double elimination losers final winner into the grand final", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_5",
      bracket: "LOSERS",
      round: 2,
      matchNumber: 1,
      homeParticipantId: "p4",
      awayParticipantId: "p2",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
        format: "DOUBLE_ELIMINATION",
      },
    });
    prismaFake.battlegroundsTournamentMatch.count.mockResolvedValue(2);
    prismaFake.battlegroundsTournamentMatch.findFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("matchId", "match_5");
    formData.set("homeScore", "1");
    formData.set("awayScore", "2");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "tournament_1",
        bracket: "GRAND_FINAL",
        round: 1,
        matchNumber: 1,
        awayParticipantId: "p2",
        status: "READY",
      }),
    });
  });

  it("creates a reset grand final when the losers bracket finalist wins grand final one", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_gf_1",
      bracket: "GRAND_FINAL",
      round: 1,
      matchNumber: 1,
      homeParticipantId: "p1",
      awayParticipantId: "p2",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
        format: "DOUBLE_ELIMINATION",
      },
    });
    prismaFake.battlegroundsTournamentMatch.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "match_gf_2", status: "READY" });

    const formData = new FormData();
    formData.set("matchId", "match_gf_1");
    formData.set("homeScore", "1");
    formData.set("awayScore", "2");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "tournament_1",
        bracket: "GRAND_FINAL",
        round: 2,
        matchNumber: 1,
        homeParticipantId: "p1",
        status: "READY",
      }),
    });
    expect(prismaFake.battlegroundsTournamentMatch.update).toHaveBeenCalledWith({
      where: { id: "match_gf_2" },
      data: expect.objectContaining({
        awayParticipantId: "p2",
        status: "READY",
      }),
    });
  });

  it("rejects changing grand final one after the reset final is final", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_gf_1",
      bracket: "GRAND_FINAL",
      round: 1,
      matchNumber: 1,
      homeParticipantId: "p1",
      awayParticipantId: "p2",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
        format: "DOUBLE_ELIMINATION",
      },
    });
    prismaFake.battlegroundsTournamentMatch.findFirst.mockResolvedValue({ id: "match_gf_2" });

    const formData = new FormData();
    formData.set("matchId", "match_gf_1");
    formData.set("homeScore", "2");
    formData.set("awayScore", "1");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({
      success: false,
      error: "Cannot change this result after the next fight is final.",
    });

    expect(prismaFake.battlegroundsTournamentMatch.update).not.toHaveBeenCalled();
  });

  it("rejects changing a result after its downstream fight is final", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_1",
      round: 1,
      matchNumber: 1,
      homeParticipantId: "p1",
      awayParticipantId: "p4",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
        format: "SINGLE_ELIMINATION",
      },
    });
    prismaFake.battlegroundsTournamentMatch.findFirst.mockResolvedValue({ id: "match_3" });

    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("homeScore", "2");
    formData.set("awayScore", "1");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({
      success: false,
      error: "Cannot change this result after the next fight is final.",
    });

    expect(prismaFake.battlegroundsTournamentMatch.update).not.toHaveBeenCalled();
  });

  it("rejects a final result when the selected winner contradicts the score", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_1",
      homeParticipantId: "p1",
      awayParticipantId: "p2",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
      },
    });

    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("homeScore", "3");
    formData.set("awayScore", "2");
    formData.set("winnerParticipantId", "p2");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({
      success: false,
      error: "Winner must match the score.",
    });

    expect(prismaFake.battlegroundsTournamentMatch.update).not.toHaveBeenCalled();
  });

  it("rejects a scoreless final between two players", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_1",
      homeParticipantId: "p1",
      awayParticipantId: "p2",
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
      },
    });

    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("winnerParticipantId", "p1");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({
      success: false,
      error: "Final matches need both scores.",
    });

    expect(prismaFake.battlegroundsTournamentMatch.update).not.toHaveBeenCalled();
  });

  it("allows a scoreless final for bye advancement", async () => {
    prismaFake.battlegroundsTournamentMatch.findUnique.mockResolvedValue({
      id: "match_1",
      homeParticipantId: "p1",
      awayParticipantId: null,
      tournament: {
        id: "tournament_1",
        allianceId: "alliance_1",
        createdById: "player_1",
      },
    });

    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("winnerParticipantId", "p1");
    formData.set("status", "FINAL");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournamentMatch.update).toHaveBeenCalledWith({
      where: { id: "match_1" },
      data: expect.objectContaining({
        homeScore: null,
        awayScore: null,
        winnerParticipantId: "p1",
        status: "FINAL",
      }),
    });
  });

  it("rejects invalid match statuses", async () => {
    const formData = new FormData();
    formData.set("matchId", "match_1");
    formData.set("homeScore", "3");
    formData.set("awayScore", "2");
    formData.set("winnerParticipantId", "p1");
    formData.set("status", "BROKEN");

    await expect(recordTournamentMatchResult(formData)).resolves.toEqual({
      success: false,
      error: "Choose a valid match status.",
    });

    expect(prismaFake.battlegroundsTournamentMatch.findUnique).not.toHaveBeenCalled();
    expect(prismaFake.battlegroundsTournamentMatch.update).not.toHaveBeenCalled();
  });
});
