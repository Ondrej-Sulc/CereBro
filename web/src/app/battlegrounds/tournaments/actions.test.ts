import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  battlegroundsTournament: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  battlegroundsTournamentMatch: {
    createMany: vi.fn(),
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
  createTournament,
  generateTournamentMatches,
  recordTournamentMatchResult,
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
    prismaFake.battlegroundsTournamentMatch.createMany.mockResolvedValue({ count: 2 });
    prismaFake.battlegroundsTournamentMatch.update.mockResolvedValue({ id: "match_1" });
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
});
