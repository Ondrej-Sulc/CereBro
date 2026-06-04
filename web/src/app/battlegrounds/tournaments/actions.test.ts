import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @prisma/client enums used by actions.ts
// ---------------------------------------------------------------------------

vi.mock("@prisma/client", () => ({
  BattlegroundsTournamentFormat: {
    SINGLE_ELIMINATION: "SINGLE_ELIMINATION",
    DOUBLE_ELIMINATION: "DOUBLE_ELIMINATION",
    SWISS: "SWISS",
    SWISS_TOP_CUT: "SWISS_TOP_CUT",
    ROUND_ROBIN: "ROUND_ROBIN",
    LADDER: "LADDER",
  },
  BattlegroundsTournamentScope: {
    COMMUNITY: "COMMUNITY",
    ALLIANCE: "ALLIANCE",
  },
  BattlegroundsTournamentStatus: {
    DRAFT: "DRAFT",
    REGISTRATION: "REGISTRATION",
    CHECK_IN: "CHECK_IN",
    LIVE: "LIVE",
    FINISHED: "FINISHED",
    ARCHIVED: "ARCHIVED",
  },
  TournamentParticipantStatus: {
    INVITED: "INVITED",
    CONFIRMED: "CONFIRMED",
    CHECKED_IN: "CHECKED_IN",
    DROPPED: "DROPPED",
  },
}));

// ---------------------------------------------------------------------------
// Hoisted fakes (must be declared before vi.mock calls)
// ---------------------------------------------------------------------------

const prismaFake = vi.hoisted(() => ({
  battlegroundsTournament: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  battlegroundsTournamentParticipant: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  player: {
    findUnique: vi.fn(),
  },
}));

const authFake = vi.hoisted(() => ({
  getUserPlayerWithAlliance: vi.fn(),
}));

const alliancePermsFake = vi.hoisted(() => ({
  canPlanAllianceWar: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authFake);
vi.mock("@/lib/alliance-permissions", () => alliancePermsFake);
vi.mock("next/cache", () => cacheFake);
vi.mock("@/lib/logger", () => ({
  default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));

// ---------------------------------------------------------------------------
// Import actions AFTER mocks are installed
// ---------------------------------------------------------------------------

import {
  createTournament,
  updateTournamentStatus,
  addTournamentParticipant,
  removeTournamentParticipant,
  joinTournament,
} from "./actions";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Record<string, unknown> = {}) {
  return {
    id: "player-1",
    allianceId: "alliance-1",
    isBotAdmin: false,
    isOfficer: false,
    isPlanner: false,
    battlegroup: 1,
    ...overrides,
  };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("battlegrounds tournaments server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alliancePermsFake.canPlanAllianceWar.mockReturnValue(false);
  });

  // -------------------------------------------------------------------------
  // createTournament
  // -------------------------------------------------------------------------

  describe("createTournament", () => {
    it("creates a community tournament and revalidates the path", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "t-1" });

      const fd = makeFormData({
        name: "Friday BG Gauntlet",
        description: "No rules",
        scope: "COMMUNITY",
        format: "SINGLE_ELIMINATION",
      });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Friday BG Gauntlet",
          description: "No rules",
          scope: "COMMUNITY",
          format: "SINGLE_ELIMINATION",
          allianceId: null,
          createdById: "player-1",
        }),
      });
      expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/battlegrounds/tournaments");
    });

    it("creates an alliance tournament when player has an alliance and scope is ALLIANCE", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ allianceId: "alliance-1" }));
      prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "t-2" });

      const fd = makeFormData({
        name: "Alliance Friendly",
        scope: "ALLIANCE",
        format: "SWISS",
      });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scope: "ALLIANCE",
          allianceId: "alliance-1",
        }),
      });
    });

    it("falls back to COMMUNITY scope even if ALLIANCE requested when player has no alliance", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ allianceId: null }));
      prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "t-3" });

      const fd = makeFormData({ name: "Open Event", scope: "ALLIANCE" });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scope: "COMMUNITY",
          allianceId: null,
        }),
      });
    });

    it("returns an error when name is missing", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());

      const fd = makeFormData({ name: "   ", scope: "COMMUNITY" });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: false, error: "Tournament name is required." });
      expect(prismaFake.battlegroundsTournament.create).not.toHaveBeenCalled();
    });

    it("returns an error when the start date string is invalid", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());

      const fd = makeFormData({ name: "Bad Date Event", startsAt: "not-a-date" });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: false, error: "Use valid dates or leave date fields empty." });
      expect(prismaFake.battlegroundsTournament.create).not.toHaveBeenCalled();
    });

    it("returns an error when the check-in date string is invalid", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());

      const fd = makeFormData({
        name: "Bad CheckIn Event",
        startsAt: "2026-08-01T18:00",
        checkInStartsAt: "garbage",
      });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: false, error: "Use valid dates or leave date fields empty." });
    });

    it("accepts valid ISO date strings", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "t-4" });

      const fd = makeFormData({
        name: "Scheduled Event",
        startsAt: "2026-08-15T20:00",
        checkInStartsAt: "2026-08-15T19:00",
      });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startsAt: expect.any(Date),
          checkInStartsAt: expect.any(Date),
        }),
      });
    });

    it("allows empty date fields (null) when not provided", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "t-5" });

      const fd = makeFormData({ name: "Undated Event" });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ startsAt: null, checkInStartsAt: null }),
      });
    });

    it("defaults to SINGLE_ELIMINATION format when an unknown format is submitted", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "t-6" });

      const fd = makeFormData({ name: "Test", format: "DOES_NOT_EXIST" });

      const result = await createTournament(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ format: "SINGLE_ELIMINATION" }),
      });
    });

    it("accepts all valid tournament formats", async () => {
      const formats = [
        "SINGLE_ELIMINATION",
        "DOUBLE_ELIMINATION",
        "SWISS",
        "SWISS_TOP_CUT",
        "ROUND_ROBIN",
        "LADDER",
      ];

      for (const format of formats) {
        vi.clearAllMocks();
        authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
        prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: `t-${format}` });

        const fd = makeFormData({ name: "Test", format });
        const result = await createTournament(fd);

        expect(result).toEqual({ success: true });
        expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ format }),
        });
      }
    });

    it("stores empty description as null, not an empty string", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "t-7" });

      const fd = makeFormData({ name: "No Description", description: "" });
      await createTournament(fd);

      expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: null }),
      });
    });

    it("throws when the player is not logged in", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(null);

      const fd = makeFormData({ name: "Test" });

      await expect(createTournament(fd)).rejects.toThrow("You must be logged in to manage tournaments.");
    });
  });

  // -------------------------------------------------------------------------
  // updateTournamentStatus
  // -------------------------------------------------------------------------

  describe("updateTournamentStatus", () => {
    it("updates the status when the requester is the tournament creator", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "creator-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "alliance-1",
        createdById: "creator-1",
      });
      prismaFake.battlegroundsTournament.update.mockResolvedValue({});

      const result = await updateTournamentStatus("t-1", "LIVE");

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournament.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { status: "LIVE" },
      });
      expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/battlegrounds/tournaments");
    });

    it("updates the status when the requester is a bot admin", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ isBotAdmin: true, id: "admin-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "other-alliance",
        createdById: "creator-99",
      });
      prismaFake.battlegroundsTournament.update.mockResolvedValue({});

      const result = await updateTournamentStatus("t-1", "FINISHED");

      expect(result).toEqual({ success: true });
    });

    it("updates the status when the requester is an alliance planner for an alliance tournament", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "officer-1", allianceId: "alliance-1", isBotAdmin: false })
      );
      alliancePermsFake.canPlanAllianceWar.mockReturnValue(true);
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "alliance-1",
        createdById: "creator-99",
      });
      prismaFake.battlegroundsTournament.update.mockResolvedValue({});

      const result = await updateTournamentStatus("t-1", "CHECK_IN");

      expect(result).toEqual({ success: true });
    });

    it("returns not-found when requester has no management rights", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "nobody", allianceId: "other-alliance", isBotAdmin: false })
      );
      alliancePermsFake.canPlanAllianceWar.mockReturnValue(false);
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "alliance-1",
        createdById: "creator-99",
      });

      const result = await updateTournamentStatus("t-1", "LIVE");

      expect(result).toEqual({ success: false, error: "Tournament not found." });
      expect(prismaFake.battlegroundsTournament.update).not.toHaveBeenCalled();
    });

    it("returns not-found when the tournament does not exist", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue(null);

      const result = await updateTournamentStatus("non-existent", "LIVE");

      expect(result).toEqual({ success: false, error: "Tournament not found." });
    });

    it("all valid statuses are accepted", async () => {
      const statuses = ["DRAFT", "REGISTRATION", "CHECK_IN", "LIVE", "FINISHED", "ARCHIVED"] as const;

      for (const status of statuses) {
        vi.clearAllMocks();
        authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "creator-1" }));
        prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
          allianceId: null,
          createdById: "creator-1",
        });
        prismaFake.battlegroundsTournament.update.mockResolvedValue({});

        const result = await updateTournamentStatus("t-1", status);
        expect(result).toEqual({ success: true });
      }
    });
  });

  // -------------------------------------------------------------------------
  // addTournamentParticipant
  // -------------------------------------------------------------------------

  describe("addTournamentParticipant", () => {
    it("adds a participant to a community tournament", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1", allianceId: "alliance-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "alliance-1",
        createdById: "manager-1",
        scope: "COMMUNITY",
      });
      prismaFake.player.findUnique.mockResolvedValue({
        id: "entrant-1",
        allianceId: "alliance-2",
        battlegroup: 2,
      });
      prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-1" });

      const fd = makeFormData({
        tournamentId: "t-1",
        playerId: "entrant-1",
        seed: "3",
        status: "CONFIRMED",
      });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tournamentId: "t-1",
          playerId: "entrant-1",
          seed: 3,
          battlegroup: 2,
          status: "CONFIRMED",
        }),
      });
      expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/battlegrounds/tournaments");
    });

    it("rejects a participant from a different alliance for an alliance-scoped tournament", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1", allianceId: "alliance-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "alliance-1",
        createdById: "manager-1",
        scope: "ALLIANCE",
      });
      prismaFake.player.findUnique.mockResolvedValue({
        id: "outsider-1",
        allianceId: "different-alliance",
        battlegroup: null,
      });

      const fd = makeFormData({
        tournamentId: "t-1",
        playerId: "outsider-1",
      });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: false, error: "That player is not in this alliance tournament." });
      expect(prismaFake.battlegroundsTournamentParticipant.create).not.toHaveBeenCalled();
    });

    it("returns an error when tournamentId or playerId is missing", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());

      const fd = makeFormData({ tournamentId: "t-1" }); // missing playerId

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: false, error: "Choose a tournament and player." });
    });

    it("returns an error when the tournament is not found or manager has no rights", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "nobody" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue(null);
      prismaFake.player.findUnique.mockResolvedValue({ id: "entrant-1", allianceId: null, battlegroup: null });

      const fd = makeFormData({ tournamentId: "t-1", playerId: "entrant-1" });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: false, error: "Tournament not found." });
    });

    it("returns an error when the entrant player is not found", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: null,
        createdById: "manager-1",
        scope: "COMMUNITY",
      });
      prismaFake.player.findUnique.mockResolvedValue(null);

      const fd = makeFormData({ tournamentId: "t-1", playerId: "ghost-player" });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: false, error: "Player not found." });
    });

    it("rejects a non-positive seed", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: null,
        createdById: "manager-1",
        scope: "COMMUNITY",
      });
      prismaFake.player.findUnique.mockResolvedValue({ id: "entrant-1", allianceId: null, battlegroup: null });

      const fd = makeFormData({ tournamentId: "t-1", playerId: "entrant-1", seed: "0" });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: false, error: "Seed must be a positive whole number." });
    });

    it("rejects a negative seed", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: null,
        createdById: "manager-1",
        scope: "COMMUNITY",
      });
      prismaFake.player.findUnique.mockResolvedValue({ id: "entrant-1", allianceId: null, battlegroup: null });

      const fd = makeFormData({ tournamentId: "t-1", playerId: "entrant-1", seed: "-5" });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: false, error: "Seed must be a positive whole number." });
    });

    it("returns a duplicate error when the prisma create throws", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: null,
        createdById: "manager-1",
        scope: "COMMUNITY",
      });
      prismaFake.player.findUnique.mockResolvedValue({ id: "entrant-1", allianceId: null, battlegroup: null });
      prismaFake.battlegroundsTournamentParticipant.create.mockRejectedValue(new Error("Unique constraint violation"));

      const fd = makeFormData({ tournamentId: "t-1", playerId: "entrant-1" });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: false, error: "This player or seed is already in the tournament." });
    });

    it("adds participant with no seed when seed field is empty", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: null,
        createdById: "manager-1",
        scope: "COMMUNITY",
      });
      prismaFake.player.findUnique.mockResolvedValue({ id: "entrant-1", allianceId: null, battlegroup: null });
      prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-1" });

      const fd = makeFormData({ tournamentId: "t-1", playerId: "entrant-1", seed: "" });

      const result = await addTournamentParticipant(fd);

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ seed: null }),
      });
    });

    it("defaults participant status to CONFIRMED when an unknown status is submitted", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: null,
        createdById: "manager-1",
        scope: "COMMUNITY",
      });
      prismaFake.player.findUnique.mockResolvedValue({ id: "entrant-1", allianceId: null, battlegroup: null });
      prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-1" });

      const fd = makeFormData({ tournamentId: "t-1", playerId: "entrant-1", status: "BOGUS" });

      await addTournamentParticipant(fd);

      expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: "CONFIRMED" }),
      });
    });

    it("accepts all valid participant statuses", async () => {
      const statuses = ["INVITED", "CONFIRMED", "CHECKED_IN", "DROPPED"];

      for (const status of statuses) {
        vi.clearAllMocks();
        authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "manager-1" }));
        prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
          allianceId: null,
          createdById: "manager-1",
          scope: "COMMUNITY",
        });
        prismaFake.player.findUnique.mockResolvedValue({ id: "entrant-1", allianceId: null, battlegroup: null });
        prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-1" });

        const fd = makeFormData({ tournamentId: "t-1", playerId: "entrant-1", status });
        await addTournamentParticipant(fd);

        expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ status }),
        });
      }
    });
  });

  // -------------------------------------------------------------------------
  // removeTournamentParticipant
  // -------------------------------------------------------------------------

  describe("removeTournamentParticipant", () => {
    it("removes a participant when the requester is the tournament creator", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "creator-1" }));
      prismaFake.battlegroundsTournamentParticipant.findUnique.mockResolvedValue({
        tournament: { allianceId: null, createdById: "creator-1" },
      });
      prismaFake.battlegroundsTournamentParticipant.delete.mockResolvedValue({});

      const result = await removeTournamentParticipant("participant-1");

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournamentParticipant.delete).toHaveBeenCalledWith({
        where: { id: "participant-1" },
      });
      expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/battlegrounds/tournaments");
    });

    it("removes a participant when the requester is a bot admin", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ isBotAdmin: true, id: "admin-1" }));
      prismaFake.battlegroundsTournamentParticipant.findUnique.mockResolvedValue({
        tournament: { allianceId: "alliance-1", createdById: "someone-else" },
      });
      prismaFake.battlegroundsTournamentParticipant.delete.mockResolvedValue({});

      const result = await removeTournamentParticipant("participant-1");

      expect(result).toEqual({ success: true });
    });

    it("returns not-found when participant does not exist", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournamentParticipant.findUnique.mockResolvedValue(null);

      const result = await removeTournamentParticipant("ghost-participant");

      expect(result).toEqual({ success: false, error: "Participant not found." });
      expect(prismaFake.battlegroundsTournamentParticipant.delete).not.toHaveBeenCalled();
    });

    it("returns not-found when requester has no management rights over the tournament", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "nobody", allianceId: "other-alliance", isBotAdmin: false })
      );
      alliancePermsFake.canPlanAllianceWar.mockReturnValue(false);
      prismaFake.battlegroundsTournamentParticipant.findUnique.mockResolvedValue({
        tournament: { allianceId: "alliance-1", createdById: "creator-1" },
      });

      const result = await removeTournamentParticipant("participant-1");

      expect(result).toEqual({ success: false, error: "Participant not found." });
      expect(prismaFake.battlegroundsTournamentParticipant.delete).not.toHaveBeenCalled();
    });

    it("allows an alliance officer to remove participants from their alliance tournament", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "officer-1", allianceId: "alliance-1", isBotAdmin: false })
      );
      alliancePermsFake.canPlanAllianceWar.mockReturnValue(true);
      prismaFake.battlegroundsTournamentParticipant.findUnique.mockResolvedValue({
        tournament: { allianceId: "alliance-1", createdById: "creator-99" },
      });
      prismaFake.battlegroundsTournamentParticipant.delete.mockResolvedValue({});

      const result = await removeTournamentParticipant("participant-1");

      expect(result).toEqual({ success: true });
    });
  });

  // -------------------------------------------------------------------------
  // joinTournament
  // -------------------------------------------------------------------------

  describe("joinTournament", () => {
    it("lets a player join a community tournament in REGISTRATION status", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "player-2", allianceId: "alliance-1", battlegroup: 2 })
      );
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        id: "t-1",
        scope: "COMMUNITY",
        allianceId: null,
        status: "REGISTRATION",
      });
      prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-2" });

      const result = await joinTournament("t-1");

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tournamentId: "t-1",
          playerId: "player-2",
          status: "CONFIRMED",
          checkedInAt: null,
        }),
      });
      expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/battlegrounds/tournaments");
    });

    it("sets status to CHECKED_IN and checkedInAt when tournament is in CHECK_IN", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "player-3", allianceId: "alliance-1", battlegroup: 3 })
      );
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        id: "t-1",
        scope: "COMMUNITY",
        allianceId: null,
        status: "CHECK_IN",
      });
      prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-3" });

      const result = await joinTournament("t-1");

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "CHECKED_IN",
          checkedInAt: expect.any(Date),
        }),
      });
    });

    it("returns an error when the tournament status is not open for registration", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());

      for (const status of ["DRAFT", "LIVE", "FINISHED", "ARCHIVED"]) {
        vi.clearAllMocks();
        authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
        prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
          id: "t-1",
          scope: "COMMUNITY",
          allianceId: null,
          status,
        });

        const result = await joinTournament("t-1");

        expect(result).toEqual({
          success: false,
          error: "Registration is not open for this tournament.",
        });
      }
    });

    it("blocks a player outside the alliance from joining an alliance tournament", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "outsider", allianceId: "different-alliance" })
      );
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        id: "t-1",
        scope: "ALLIANCE",
        allianceId: "alliance-1",
        status: "REGISTRATION",
      });

      const result = await joinTournament("t-1");

      expect(result).toEqual({ success: false, error: "This tournament is limited to its alliance." });
      expect(prismaFake.battlegroundsTournamentParticipant.create).not.toHaveBeenCalled();
    });

    it("allows alliance members to join their alliance tournament", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "member-1", allianceId: "alliance-1", battlegroup: 1 })
      );
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        id: "t-1",
        scope: "ALLIANCE",
        allianceId: "alliance-1",
        status: "REGISTRATION",
      });
      prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-4" });

      const result = await joinTournament("t-1");

      expect(result).toEqual({ success: true });
      // battlegroup should be propagated since player's allianceId matches tournament's allianceId
      expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ battlegroup: 1 }),
      });
    });

    it("sets battlegroup to null when joining a community tournament from a different alliance", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "member-x", allianceId: "alliance-x", battlegroup: 2 })
      );
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        id: "t-1",
        scope: "COMMUNITY",
        allianceId: "alliance-1",
        status: "REGISTRATION",
      });
      prismaFake.battlegroundsTournamentParticipant.create.mockResolvedValue({ id: "p-5" });

      const result = await joinTournament("t-1");

      expect(result).toEqual({ success: true });
      expect(prismaFake.battlegroundsTournamentParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ battlegroup: null }),
      });
    });

    it("returns not-found when the tournament does not exist", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer());
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue(null);

      const result = await joinTournament("ghost-tournament");

      expect(result).toEqual({ success: false, error: "Tournament not found." });
    });

    it("returns an already-enrolled error when the prisma create throws (duplicate)", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(makePlayer({ id: "player-2" }));
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        id: "t-1",
        scope: "COMMUNITY",
        allianceId: null,
        status: "REGISTRATION",
      });
      prismaFake.battlegroundsTournamentParticipant.create.mockRejectedValue(
        new Error("Unique constraint violation")
      );

      const result = await joinTournament("t-1");

      expect(result).toEqual({ success: false, error: "You are already in this tournament." });
    });

    it("throws when the player is not logged in", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(null);

      await expect(joinTournament("t-1")).rejects.toThrow("You must be logged in to manage tournaments.");
    });
  });

  // -------------------------------------------------------------------------
  // canManageTournament logic (tested through updateTournamentStatus)
  // -------------------------------------------------------------------------

  describe("canManageTournament logic", () => {
    it("denies management when tournament has no alliance and requester is not creator or admin", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "stranger", allianceId: "some-alliance", isBotAdmin: false })
      );
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: null,
        createdById: "actual-creator",
      });

      const result = await updateTournamentStatus("t-1", "LIVE");

      expect(result).toEqual({ success: false, error: "Tournament not found." });
    });

    it("grants management when allianceId matches even if canPlanAllianceWar returns true", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "planner-1", allianceId: "alliance-1", isBotAdmin: false })
      );
      alliancePermsFake.canPlanAllianceWar.mockReturnValue(true);
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "alliance-1",
        createdById: "different-creator",
      });
      prismaFake.battlegroundsTournament.update.mockResolvedValue({});

      const result = await updateTournamentStatus("t-1", "REGISTRATION");

      expect(result).toEqual({ success: true });
    });

    it("denies management when player is in different alliance even if canPlanAllianceWar is true", async () => {
      authFake.getUserPlayerWithAlliance.mockResolvedValue(
        makePlayer({ id: "planner-2", allianceId: "other-alliance", isBotAdmin: false })
      );
      alliancePermsFake.canPlanAllianceWar.mockReturnValue(true);
      prismaFake.battlegroundsTournament.findUnique.mockResolvedValue({
        allianceId: "alliance-1",
        createdById: "different-creator",
      });

      const result = await updateTournamentStatus("t-1", "REGISTRATION");

      expect(result).toEqual({ success: false, error: "Tournament not found." });
    });
  });
});