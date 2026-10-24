import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  members: vi.fn(), war: vi.fn(), tactics: vi.fn(), roster: vi.fn(), resistances: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  player: { findMany: mocks.members }, war: { findFirst: mocks.war }, warTactic: { findMany: mocks.tactics }, roster: { findMany: mocks.roster },
} }));
vi.mock("@/lib/with-request-context", () => ({ withActionContext: (_name: string, fn: unknown) => fn }));
vi.mock("@/lib/data/champion-resistances", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/data/champion-resistances")>(), getResistanceIndex: mocks.resistances,
}));

import { getAllianceRoster } from "./alliance-roster";

describe("alliance roster filter data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.members.mockResolvedValue([{ id: "player", ingameName: "Player", battlegroup: 1, avatar: null }]);
    mocks.war.mockResolvedValue({ season: 65 });
    mocks.tactics.mockResolvedValue([{ attackTagId: "hero", defenseTagId: null }]);
    mocks.resistances.mockResolvedValue([]);
  });

  it("retains source metadata, target icons, partner bindings and roster identity for shared filters and previews", async () => {
    const link = { id: 12, type: "ABILITY", source: "Incoming Bleed potency is reduced.", effectForm: "PASSIVE", effectDirection: "GAIN",
      ability: { name: "Resistance", categories: [], iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null }, synergyChampions: [] };
    const target = { name: "Bleed", iconUrl: "bleed.svg", description: null, gameGlossaryTermId: "bleed", gameGlossaryTerm: null, categories: [] };
    const champion = { id: 7, slug: "champion", name: "Champion", class: "SKILL", images: {}, tags: [{ id: "hero", name: "Hero" }], abilities: [link] };
    const roster = { id: "roster-1", playerId: "player", championId: 7, stars: 7, rank: 4, sigLevel: 200, isAwakened: true, isAscended: true, ascensionLevel: 2, champion };
    mocks.roster.mockResolvedValue([roster, { ...roster, id: "roster-2", stars: 6 }]);
    mocks.resistances.mockResolvedValue([{ championAbilityLink: link, effect: target, mechanism: "POTENCY", percent: 80 }]);

    const rows = await getAllianceRoster("alliance");
    expect(mocks.roster.mock.calls[0][0].where).toEqual({ playerId: { in: ["player"] } });
    expect(mocks.roster.mock.calls[0][0].include.champion.select.abilities.select).toMatchObject({ id: true, effectForm: true, effectDirection: true });
    expect(rows[0]).toMatchObject({ id: "roster-1", playerId: "player", ascensionLevel: 2, tactics: { attack: true, defense: false },
      champion: { slug: "champion", abilities: [{ effectForm: "PASSIVE", effectDirection: "GAIN", resistances: [{ effect: target, mechanism: "POTENCY", percent: 80 }] }] } });
    expect(rows[1].champion).toBe(rows[0].champion);
    expect(mocks.resistances).toHaveBeenCalledOnce();
  });

  it("returns an empty roster without fetching kits when the alliance has no members", async () => {
    mocks.members.mockResolvedValue([]);
    expect(await getAllianceRoster("empty")).toEqual([]);
    expect(mocks.roster).not.toHaveBeenCalled();
    expect(mocks.resistances).not.toHaveBeenCalled();
  });
});
