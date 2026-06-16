import { ChampionClass } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  war: {
    findMany: vi.fn(),
  },
  warFight: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/cache", () => ({
  getFromCache: vi.fn((_key: string, _ttl: number, fetchData: () => Promise<unknown>) => fetchData()),
}));

import {
  aggregatePlayerWarInsights,
  getAvailablePlayerWarInsightSeasons,
  getPlayerWarInsights,
  normalizePlayerWarInsightScope,
} from "./player-war-insights";

const championImages = { icon: "champ.png" };

function fight(overrides: Partial<Parameters<typeof aggregatePlayerWarInsights>[0]["fights"][number]> = {}) {
  return {
    warId: "war-1",
    battlegroup: 1,
    death: 0,
    node: { nodeNumber: 1 },
    attacker: {
      id: 1,
      name: "Hulkling",
      class: ChampionClass.COSMIC,
      images: championImages,
    },
    ...overrides,
  };
}

describe("player war insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes missing, all, and invalid seasons to the all-season scope", () => {
    expect(normalizePlayerWarInsightScope(undefined, [38, 37])).toEqual({ type: "all" });
    expect(normalizePlayerWarInsightScope("all", [38, 37])).toEqual({ type: "all" });
    expect(normalizePlayerWarInsightScope("not-a-season", [38, 37])).toEqual({ type: "all" });
    expect(normalizePlayerWarInsightScope("36", [38, 37])).toEqual({ type: "all" });
    expect(normalizePlayerWarInsightScope("37", [38, 37])).toEqual({ type: "season", season: 37 });
  });

  it("aggregates totals, nodes, attackers, battlegroups, and solo rate", () => {
    const insights = aggregatePlayerWarInsights({
      scope: { type: "all" },
      availableSeasons: [38, 37],
      fights: [
        fight({ warId: "war-1", battlegroup: 1, death: 0, node: { nodeNumber: 1 } }),
        fight({ warId: "war-1", battlegroup: 1, death: 1, node: { nodeNumber: 1 } }),
        fight({
          warId: "war-2",
          battlegroup: 2,
          death: 0,
          node: { nodeNumber: 50 },
          attacker: {
            id: 2,
            name: "Kate Bishop",
            class: ChampionClass.SKILL,
            images: championImages,
          },
        }),
      ],
    });

    expect(insights).toMatchObject({
      totalWars: 2,
      totalFights: 3,
      totalDeaths: 1,
      soloRate: 66.66666666666666,
      battlegroups: [1, 2],
    });
    expect(insights.topNodes).toEqual([
      expect.objectContaining({ nodeNumber: 1, label: "S1 P1", fights: 2, deaths: 1, soloRate: 50 }),
      expect.objectContaining({ nodeNumber: 50, label: "Boss", fights: 1, deaths: 0, soloRate: 100 }),
    ]);
    expect(insights.topNodeGroups).toEqual([
      expect.objectContaining({ label: "S1 P1", nodeNumbers: [1], fights: 2, deaths: 1, soloRate: 50 }),
      expect.objectContaining({ label: "Boss", nodeNumbers: [50], fights: 1, deaths: 0, soloRate: 100 }),
    ]);
    expect(insights.topAttackers).toEqual([
      expect.objectContaining({ championId: 1, name: "Hulkling", fights: 2, deaths: 1, soloRate: 50 }),
      expect.objectContaining({ championId: 2, name: "Kate Bishop", fights: 1, deaths: 0, soloRate: 100 }),
    ]);
  });

  it("groups nodes by section path while collapsing mini-boss nodes", () => {
    const insights = aggregatePlayerWarInsights({
      scope: { type: "all" },
      availableSeasons: [38],
      fights: [
        fight({ node: { nodeNumber: 6 }, death: 0 }),
        fight({ node: { nodeNumber: 15 }, death: 1 }),
        fight({ node: { nodeNumber: 40 }, death: 0 }),
        fight({ node: { nodeNumber: 41 }, death: 0 }),
        fight({ node: { nodeNumber: 46 }, death: 0 }),
      ],
    });

    expect(insights.topNodeGroups).toEqual([
      expect.objectContaining({ label: "Mini-bosses", nodeNumbers: [40, 41, 46], fights: 3, deaths: 0 }),
      expect.objectContaining({ label: "S1 P6", nodeNumbers: [6, 15], fights: 2, deaths: 1 }),
    ]);
  });

  it("sorts tied node and attacker counts by solo rate before stable labels", () => {
    const insights = aggregatePlayerWarInsights({
      scope: { type: "season", season: 38 },
      availableSeasons: [38],
      fights: [
        fight({ node: { nodeNumber: 2 }, death: 1 }),
        fight({ node: { nodeNumber: 2 }, death: 0 }),
        fight({
          node: { nodeNumber: 3 },
          death: 0,
          attacker: { id: 3, name: "Absorbing Man", class: ChampionClass.MYSTIC, images: championImages },
        }),
        fight({
          node: { nodeNumber: 3 },
          death: 0,
          attacker: { id: 3, name: "Absorbing Man", class: ChampionClass.MYSTIC, images: championImages },
        }),
        fight({
          node: { nodeNumber: 4 },
          death: 0,
          attacker: { id: 4, name: "America Chavez", class: ChampionClass.MYSTIC, images: championImages },
        }),
        fight({
          node: { nodeNumber: 4 },
          death: 0,
          attacker: { id: 4, name: "America Chavez", class: ChampionClass.MYSTIC, images: championImages },
        }),
      ],
    });

    expect(insights.topNodes.map((node) => node.nodeNumber)).toEqual([3, 4, 2]);
    expect(insights.topAttackers.map((attacker) => attacker.name)).toEqual([
      "Absorbing Man",
      "America Chavez",
      "Hulkling",
    ]);
  });

  it("counts fights with missing attackers in totals while excluding them from attacker insights", () => {
    const insights = aggregatePlayerWarInsights({
      scope: { type: "all" },
      availableSeasons: [38],
      fights: [fight({ attacker: null }), fight()],
    });

    expect(insights.totalFights).toBe(2);
    expect(insights.topAttackers).toHaveLength(1);
    expect(insights.topAttackers[0]).toMatchObject({ championId: 1, fights: 1 });
  });

  it("loads available seasons from qualifying numbered non-planning player wars", async () => {
    prismaFake.war.findMany.mockResolvedValueOnce([{ season: 38 }, { season: 37 }]);

    await expect(getAvailablePlayerWarInsightSeasons({
      playerId: "player-1",
      allianceId: "alliance-1",
    })).resolves.toEqual([38, 37]);

    expect(prismaFake.war.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        allianceId: "alliance-1",
        status: { not: "PLANNING" },
        warNumber: { not: null },
        season: { not: 0 },
        fights: { some: { playerId: "player-1" } },
      },
    }));
  });

  it("restricts all-season insight queries to numbered non-planning wars", async () => {
    prismaFake.war.findMany.mockResolvedValueOnce([{ season: 38 }]);
    prismaFake.warFight.findMany.mockResolvedValueOnce([]);

    await getPlayerWarInsights({
      playerId: "player-1",
      allianceId: "alliance-1",
      scope: { type: "all" },
    });

    expect(prismaFake.warFight.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        playerId: "player-1",
        war: {
          allianceId: "alliance-1",
          status: { not: "PLANNING" },
          warNumber: { not: null },
          season: { not: 0 },
        },
      },
    }));
  });

  it("adds a season constraint for season-scoped insight queries", async () => {
    prismaFake.war.findMany.mockResolvedValueOnce([{ season: 38 }]);
    prismaFake.warFight.findMany.mockResolvedValueOnce([]);

    await getPlayerWarInsights({
      playerId: "player-1",
      allianceId: "alliance-1",
      scope: { type: "season", season: 38 },
    });

    expect(prismaFake.warFight.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        war: expect.objectContaining({ season: 38 }),
      }),
    }));
  });
});
