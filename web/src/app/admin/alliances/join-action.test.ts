import { beforeEach, describe, expect, it, vi } from "vitest";

const db = await vi.hoisted(async () => {
  const { createMembershipDatabase } = await import("../../../../../src/tests/fixtures/alliance-membership");
  return createMembershipDatabase();
});
const boundary = vi.hoisted(() => ({
  getUserPlayerWithAlliance: vi.fn(),
  clearCache: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/auth-helpers", () => boundary);
vi.mock("@/lib/cache", () => boundary);
vi.mock("next/cache", () => boundary);
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/with-request-context", () => ({ withActionContext: (_name: string, fn: unknown) => fn }));
vi.mock("@cerebro/core/services/allianceMembershipService", () => import("../../../../../src/services/allianceMembershipService"));

import { joinAllianceAsAdmin } from "./join-action";

describe("admin alliance transfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    boundary.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[1], isBotAdmin: true });
  });

  it("releases former-alliance templates and roles before joining another alliance", async () => {
    await expect(joinAllianceAsAdmin("alliance-2")).rejects.toThrow("redirect:/alliance/roster");
    expect(db.read().members[1]).toMatchObject({ allianceId: "alliance-2", battlegroup: null, isOfficer: false, isPlanner: false });
    expect(db.read().placements.find((row) => row.id === "assigned")).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
    expect(db.read().placements.find((row) => row.id === "foreign")?.defenderId).toBe(104);
    expect(boundary.clearCache).toHaveBeenCalledWith("alliance-members-alliance-1");
    expect(boundary.clearCache).toHaveBeenCalledWith("alliance-members-alliance-2");
  });

  it("preserves assignments when opening the alliance the admin already belongs to", async () => {
    const placements = structuredClone(db.read().placements);
    await expect(joinAllianceAsAdmin("alliance-1")).rejects.toThrow("redirect:/alliance/roster");
    expect(db.read().placements).toEqual(placements);
  });

  it("rolls back the transfer if cleanup fails", async () => {
    const before = structuredClone(db.read());
    db.prisma.warDefensePlacement.updateMany.mockRejectedValueOnce(new Error("cleanup unavailable"));
    await expect(joinAllianceAsAdmin("alliance-2")).rejects.toThrow("cleanup unavailable");
    expect(db.read()).toEqual(before);
    expect(boundary.clearCache).not.toHaveBeenCalled();
    expect(boundary.revalidatePath).not.toHaveBeenCalled();
  });

  it("requires server-side admin authorization", async () => {
    boundary.getUserPlayerWithAlliance.mockResolvedValue({ ...db.read().members[1], isBotAdmin: false });
    const before = structuredClone(db.read());
    await expect(joinAllianceAsAdmin("alliance-2")).rejects.toThrow("redirect:/");
    expect(db.read()).toEqual(before);
  });
});
