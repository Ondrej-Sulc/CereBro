import { beforeEach, describe, expect, it, vi } from "vitest";

const db = await vi.hoisted(async () => {
  const { createMembershipDatabase } = await import("../../../../src/tests/fixtures/alliance-membership");
  return createMembershipDatabase();
});
const auth = vi.hoisted(() => ({ getUserPlayerWithAlliance: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/auth-helpers", () => auth);
vi.mock("@/lib/with-request-context", () => ({ withActionContext: (_name: string, fn: unknown) => fn }));
vi.mock("@/lib/alliance-permissions", () => import("../../lib/alliance-permissions"));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache", () => ({ clearCache: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@cerebro/core/config", () => ({ config: { BOT_TOKEN: "test" } }));
vi.mock("@cerebro/core/services/allianceMembershipService", () => import("../../../../src/services/allianceMembershipService"));
vi.mock("@cerebro/core/services/mapImageService", () => ({ MapImageService: {} }));
vi.mock("@/lib/championHelper", () => ({ getChampionImageUrl: vi.fn() }));
vi.mock("@/lib/discord-config-validation", () => ({}));

import { removeMember } from "../actions/alliance";
import { updateDefensePlacement } from "./defense-actions";

const modes = ["id", "upsert-update", "upsert-create"] as const;
function target(mode: typeof modes[number]) {
  return mode === "id" ? { id: "assigned" } : {
    planId: "active-plan", battlegroup: 1, nodeId: mode === "upsert-create" ? 5 : 1,
  };
}
function saved(mode: typeof modes[number]) {
  return db.read().placements.find((row) => row.id === (mode === "upsert-create" ? "created-placement" : "assigned"));
}

describe("defense placement membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[0], isBotAdmin: false });
  });

  it("rejects the departed player resubmitted by an already-open planner", async () => {
    const stalePlacement = { ...db.read().placements[0] };
    await removeMember("departing");
    const before = structuredClone(db.read());

    await expect(updateDefensePlacement(stalePlacement)).rejects.toThrow("Player is not a member of this plan's alliance.");
    expect(db.read()).toEqual(before);
  });

  it.each(["id", "coordinates"])("rejects partial %s edits that retain an ineligible player", async (mode) => {
    db.read().members[1].allianceId = "alliance-2";
    const before = structuredClone(db.read());
    const target = mode === "id" ? { id: "assigned" } : { planId: "active-plan", battlegroup: 1, nodeId: 1 };

    await expect(updateDefensePlacement({ ...target, defenderId: 102 })).rejects.toThrow("Player is not a member of this plan's alliance.");
    expect(db.read()).toEqual(before);
  });

  describe.each(modes)("%s", (mode) => {
    it.each(["departed", "other-alliance", "missing"])("rejects a %s player without changing rows", async (scenario) => {
      if (scenario === "departed") await removeMember("departing");
      if (scenario === "other-alliance") db.read().members[1].allianceId = "alliance-2";
      const before = structuredClone(db.read());
      await expect(updateDefensePlacement({
        ...target(mode), playerId: scenario === "missing" ? "missing" : "departing", defenderId: 102, starLevel: 6,
      })).rejects.toThrow("Player is not a member of this plan's alliance.");
      expect(db.read()).toEqual(before);
    });

    it("accepts a same-alliance player and all requested defender changes", async () => {
      await updateDefensePlacement({ ...target(mode), playerId: "officer", defenderId: 102, starLevel: 6 });
      expect(saved(mode)).toMatchObject({ playerId: "officer", defenderId: 102, starLevel: 6 });
    });

    it("accepts an unassigned defender without discarding the defender changes", async () => {
      await updateDefensePlacement({ ...target(mode), playerId: null, defenderId: 102, starLevel: 6 });
      expect(saved(mode)).toMatchObject({ playerId: null, defenderId: 102, starLevel: 6 });
    });

    it("clears a slot when every assignment field is null", async () => {
      await updateDefensePlacement({ ...target(mode), playerId: null, defenderId: null, starLevel: null });
      expect(saved(mode)).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    });

    it("preserves omitted fields in a partial defender edit", async () => {
      await updateDefensePlacement({ ...target(mode), defenderId: 102 });
      expect(saved(mode)).toMatchObject({
        playerId: mode === "upsert-create" ? null : "departing",
        defenderId: 102, starLevel: mode === "upsert-create" ? null : 7,
      });
    });

    it("does not change history or roster records", async () => {
      const before = structuredClone(db.read());
      await updateDefensePlacement({ ...target(mode), playerId: "officer", defenderId: 102, starLevel: 6 });
      expect(db.read().wars).toEqual(before.wars);
      expect(db.read().fights).toEqual(before.fights);
      expect(db.read().roster).toEqual(before.roster);
    });

    it("rolls back when the placement write fails", async () => {
      const before = structuredClone(db.read());
      const write = mode === "id" ? db.prisma.warDefensePlacement.update : db.prisma.warDefensePlacement.upsert;
      write.mockRejectedValueOnce(new Error("placement unavailable"));
      await expect(updateDefensePlacement({ ...target(mode), playerId: "officer", defenderId: 102 })).rejects.toThrow("placement unavailable");
      expect(db.read()).toEqual(before);
    });
  });

  it.each(["unauthenticated", "member", "other-alliance-id", "other-alliance-coordinates"])("preserves authorization for %s", async (scenario) => {
    if (scenario === "unauthenticated") auth.getUserPlayerWithAlliance.mockResolvedValue(null);
    if (scenario === "member") auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[0], isOfficer: false, isBotAdmin: false });
    const before = structuredClone(db.read());
    const placement = scenario === "other-alliance-coordinates"
      ? { planId: "other-alliance", battlegroup: 1, nodeId: 5 }
      : { id: scenario === "other-alliance-id" ? "foreign" : "assigned", planId: "active-plan" };
    await expect(updateDefensePlacement({ ...placement, playerId: null, defenderId: 102 })).rejects.toThrow();
    expect(db.read()).toEqual(before);
  });

  it("validates against the actual plan even for a bot admin", async () => {
    auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[0], isBotAdmin: true });
    const before = structuredClone(db.read());
    await expect(updateDefensePlacement({ id: "foreign", planId: "active-plan", playerId: "officer" }))
      .rejects.toThrow("Player is not a member of this plan's alliance.");
    expect(db.read()).toEqual(before);
    db.read().members[1].allianceId = "alliance-2";
    await updateDefensePlacement({ id: "foreign", playerId: "departing", defenderId: 102 });
    expect(db.read().placements.find((row) => row.id === "foreign")).toMatchObject({ playerId: "departing", defenderId: 102 });
  });

  it("accepts a partial defender edit in an already-unassigned slot", async () => {
    await updateDefensePlacement({ id: "unowned", defenderId: 102, starLevel: 6 });
    expect(db.read().placements.find((row) => row.id === "unowned"))
      .toMatchObject({ playerId: null, defenderId: 102, starLevel: 6 });
  });
});
