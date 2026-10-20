import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = await vi.hoisted(async () => {
  const { createMembershipDatabase } = await import("../../../../src/tests/fixtures/alliance-membership");
  return createMembershipDatabase();
});
const auth = vi.hoisted(() => ({ getUserPlayerWithAlliance: vi.fn() }));
const cache = vi.hoisted(() => ({ clearCache: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/auth-helpers", () => auth);
vi.mock("@/lib/cache", () => cache);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
  withRouteContext: (fn: unknown) => fn,
}));
vi.mock("@cerebro/core/config", () => ({ config: { BOT_TOKEN: "test" } }));
// Resolve workspace aliases without replacing the membership or permission logic.
vi.mock("@cerebro/core/services/allianceMembershipService", () => import("../../../../src/services/allianceMembershipService"));
vi.mock("@/lib/alliance-permissions", () => import("../../lib/alliance-permissions"));

import { leaveAlliance, removeMember } from "./alliance";
import { GET } from "../api/war-planning/placements/route";

async function readPlacements() {
  const response = await GET(new NextRequest("https://cerebro.test/api/war-planning/placements?planId=active-plan"));
  expect(response.status).toBe(200);
  return response.json() as Promise<Array<{ id: string; playerId: string | null; defenderId: number | null; starLevel: number | null }>>;
}

describe("alliance membership and defense planning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[0], isBotAdmin: false });
  });

  it("releases the removed member's defenders and reservations in every alliance template", async () => {
    const before = structuredClone(db.read());
    expect((await readPlacements()).find((row) => row.id === "assigned")?.defenderId).toBe(101);

    await expect(removeMember("departing")).resolves.toEqual({ success: true });

    const placements = await readPlacements();
    expect(placements.find((row) => row.id === "assigned")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    expect(placements.find((row) => row.id === "reserved")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    expect(db.read().placements.find((row) => row.id === "template")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    for (const id of ["teammate", "foreign", "unowned"]) {
      expect(db.read().placements.find((row) => row.id === id)).toEqual(before.placements.find((row) => row.id === id));
    }
    expect(db.read().members.find((row) => row.id === "departing")).toMatchObject({ allianceId: null, battlegroup: null, isOfficer: false, isPlanner: false });
    expect(db.read().wars).toEqual(before.wars);
    expect(db.read().fights).toEqual(before.fights);
    expect(db.read().roster).toEqual(before.roster);
    expect(cache.clearCache).toHaveBeenCalledWith("alliance-members-alliance-1");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/planning", "layout");
  });

  it("releases assignments when a member leaves voluntarily", async () => {
    auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[1], isBotAdmin: false });
    await leaveAlliance();
    expect(db.read().placements.find((row) => row.id === "assigned")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    expect(db.read().members[1].allianceId).toBeNull();
  });

  it.each(["remove", "leave"])("rolls back membership and placements if cleanup fails during %s", async (action) => {
    const before = structuredClone(db.read());
    if (action === "leave") auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[1], isBotAdmin: false });
    db.prisma.warDefensePlacement.updateMany.mockRejectedValueOnce(new Error("cleanup unavailable"));
    await expect(action === "remove" ? removeMember("departing") : leaveAlliance()).rejects.toThrow("cleanup unavailable");
    expect(db.read()).toEqual(before);
    expect(cache.clearCache).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("removes a member without assignments without deleting the player", async () => {
    db.read().placements = [];
    await removeMember("departing");
    expect(db.read().members).toHaveLength(2);
    expect(db.read().members[1].allianceId).toBeNull();
  });

  it("does not clear a newer alliance when a leave request has stale membership", async () => {
    auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[1], isBotAdmin: false });
    db.read().members[1].allianceId = "alliance-2";
    const before = structuredClone(db.read());
    await expect(leaveAlliance()).rejects.toThrow("Player not found");
    expect(db.read()).toEqual(before);
  });

  it("keeps assignments intact when the membership write fails", async () => {
    const before = structuredClone(db.read());
    db.prisma.player.update.mockRejectedValueOnce(new Error("membership unavailable"));
    await expect(removeMember("departing")).rejects.toThrow("membership unavailable");
    expect(db.read()).toEqual(before);
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["unauthenticated", "member", "other-alliance", "self", "last-officer"])("rejects %s removals without changing any rows", async (scenario) => {
    let targetId = "departing";
    if (scenario === "unauthenticated") auth.getUserPlayerWithAlliance.mockResolvedValue(null);
    if (scenario === "member") auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[1], isBotAdmin: false });
    if (scenario === "other-alliance") db.read().members[1].allianceId = "alliance-2";
    if (scenario === "self") targetId = "officer";
    if (scenario === "last-officer") {
      db.read().members[0].isOfficer = false;
      db.read().members[1].isOfficer = true;
      auth.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[0], isBotAdmin: true });
    }
    const before = structuredClone(db.read());
    await expect(removeMember(targetId)).rejects.toThrow();
    expect(db.read()).toEqual(before);
  });
});
