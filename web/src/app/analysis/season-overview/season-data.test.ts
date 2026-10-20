import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSeasonData } from "./season-data";
import { clearCache } from "../../../lib/cache";

const db = vi.hoisted(() => ({ war: { findMany: vi.fn(), groupBy: vi.fn() }, warTactic: { findMany: vi.fn() } }));
const viewer = vi.hoisted(() => ({ getUserPlayerWithAlliance: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth-helpers", () => viewer);

const fight = (id: string, death: number, assigned = true) => ({
  id, death, battlegroup: 2, defenderId: null, attacker: null, defender: null,
  player: assigned ? { id: "former-member", ingameName: "Former member", avatar: null, allianceId: "other-alliance", battlegroup: 1 } : null,
  node: { nodeNumber: 4 }, video: null, videoId: null, notes: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  clearCache("", true);
  db.war.groupBy.mockResolvedValue([]);
  db.warTactic.findMany.mockResolvedValue([]);
  viewer.getUserPlayerWithAlliance.mockResolvedValue({ allianceId: "my-alliance" });
});

describe("season death statistics", () => {
  it("includes recorded unassigned deaths and historical members without requiring today's membership", async () => {
    db.war.findMany.mockImplementation(async (query: { include: { fights: { where?: { player?: unknown } } } }) => {
      const fights = [fight("assigned", 3), fight("unassigned", 2, false)];
      return [{ id: "war-1", season: 60, warNumber: 1, warTier: 1, enemyAlliance: "Opponent", mapType: "STANDARD", fights: query.include.fights.where?.player ? fights.filter(f => f.player) : fights }];
    });
    const result = await getSeasonData("my-alliance", 60);
    expect(result.globalDeaths).toBe(5);
    expect(result.bgTotals[2].deaths).toBe(5);
    expect(result.deathDistribution.path).toBe(5);
    expect(result.hardestNodes).toMatchObject([{ nodeNumber: 4, deaths: 5 }]);
    expect(result.allPlayers).toMatchObject([{ playerId: "former-member", playerName: "Former member", battlegroup: 2, deaths: 3 }]);
    expect(result.warDeathSummaries[0].battlegroups[1].players).toMatchObject([
      { playerId: "former-member", deaths: 3 }, { playerId: null, playerName: "Unassigned / deleted player", deaths: 2 },
    ]);
    expect(db.war.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { season: 60, allianceId: "my-alliance", status: { not: "PLANNING" }, warNumber: { not: null } } }));
  });

  it.each([null, { allianceId: null }, { allianceId: "other-alliance", isBotAdmin: true }])("rejects a season read outside the active alliance before fetching/caching data (%j)", async player => {
    viewer.getUserPlayerWithAlliance.mockResolvedValue(player);
    await expect(getSeasonData("my-alliance", 60)).rejects.toThrow("Alliance membership required");
    expect(db.war.findMany).not.toHaveBeenCalled();
  });

  it("returns zero deaths for an empty season and does not attribute empty planned slots", async () => {
    db.war.findMany.mockResolvedValue([{ id: "war-empty", season: 60, warNumber: 1, warTier: 1, mapType: "STANDARD", enemyAlliance: "Opponent", fights: [fight("empty-slot", 0, false)] }]);
    const result = await getSeasonData("my-alliance", 60);
    expect(result.globalDeaths).toBe(0);
    expect(result.allPlayers).toEqual([]);
    expect(result.hardestNodes).toEqual([]);
    expect(result.warDeathSummaries[0].battlegroups.map(bg => bg.deaths)).toEqual([0, 0, 0]);
    expect(result.warDeathSummaries[0].battlegroups.flatMap(bg => bg.players)).toEqual([]);
  });

  it("does not return cached alliance statistics after the viewer changes alliance", async () => {
    db.war.findMany.mockResolvedValue([]);
    await getSeasonData("my-alliance", 60);
    db.war.findMany.mockClear();
    viewer.getUserPlayerWithAlliance.mockResolvedValue({ allianceId: "different-alliance" });
    await expect(getSeasonData("my-alliance", 60)).rejects.toThrow("Alliance membership required");
    expect(db.war.findMany).not.toHaveBeenCalled();
  });
});
