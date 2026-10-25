import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../services/prismaService";
import { overviewSourceHash } from "../../domain/champion-overview-summary";
import { resistanceEvidenceHash } from "../../domain/champion-resistance-classification";
import { findSearchChampions, findSearchRoster, getSearchEffectNames } from "./data";
import type { ChampionWithRelations } from "../../types/search";

vi.mock("../../services/prismaService", () => ({ prisma: {
  champion: { findMany: vi.fn() }, roster: { findMany: vi.fn() },
  championAbilityLink: { findMany: vi.fn() }, championAbilityText: { findMany: vi.fn() },
  gameSynergy: { findMany: vi.fn(async () => []) },
} }));
const date = new Date("2026-10-20T00:00:00Z");
const template = { raw: "Reduced Bleed potency." };
const link = { id: 1, championId: 2, abilityId: 3, type: "ABILITY" as const,
  source: "While charging Heavy, reduce incoming Bleed potency by 60%.",
  effectForm: "PASSIVE" as const, effectDirection: "GAIN" as const,
  ability: { id: 3, name: "Bleed Resistance", description: null, emoji: null, iconUrl: null, gameGlossaryTermId: null, categories: [] },
  synergyChampions: [],
};
const sourceHash = overviewSourceHash({ ...link, name: link.ability.name, synergyChampionIds: [] });
function candidate(): ChampionWithRelations {
  return { id: 2, name: "Example", slug: "example", shortName: "EX", gameId: "example", class: "MUTANT",
    releaseDate: date, createdAt: date, updatedAt: date, obtainable: ["6"], images: {}, discordEmoji: null,
    fullAbilities: {}, isPlayable: true, tags: [], attacks: [], abilities: [{ ...link,
      overviewSummary: { text: "Protection while charging Heavy.", sourceHash },
      resistances: [{ effectId: 4, effect: { ...link.ability, id: 4, name: "Bleed" }, mechanism: "POTENCY",
        percent: 60, sourceHash, evidence: { version: 1, records: [{ recordId: 5, templateHash: resistanceEvidenceHash(template) }] } }],
    }],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.champion.findMany).mockResolvedValue([candidate()]);
  vi.mocked(prisma.championAbilityLink.findMany).mockResolvedValue(candidate().abilities);
  vi.mocked(prisma.championAbilityText.findMany).mockResolvedValue([
    { id: 5, championId: 2, sourceId: "base:1", group: "base", title: null, sortOrder: 1, template },
  ]);
});

describe("validated Discord search data", () => {
  it("filters after projection and fetches only the evidence referenced by selected sources", async () => {
    expect(await findSearchChampions({ immunities: "Bleed", minResistance: 60 })).toHaveLength(1);
    expect(prisma.championAbilityText.findMany).toHaveBeenCalledWith({ where: { id: { in: [5] } },
      select: { id: true, championId: true, template: true } });
    expect(await findSearchChampions({ abilities: "Bleed Resistance" })).toEqual([]);
    expect(await findSearchChampions({ immunities: "Bleed", includeResistances: false })).toEqual([]);
  });

  it("rejects changed imported evidence in results and autocomplete", async () => {
    vi.mocked(prisma.championAbilityText.findMany).mockResolvedValue([]);
    expect(await findSearchChampions({ immunities: "Bleed" })).toEqual([]);
    expect(await getSearchEffectNames("immunities", "Bleed", {})).toEqual([]);
    expect(await getSearchEffectNames("abilities", "Bleed", {})).toEqual(["Bleed Resistance"]);
  });

  it("offers verified resistance targets and honors immunity-only autocomplete", async () => {
    expect(await getSearchEffectNames("immunities", "ble", {})).toEqual(["Bleed"]);
    expect(await getSearchEffectNames("abilities", "ble", {})).toEqual([]);
    expect(await getSearchEffectNames("immunities", "ble", { includeResistances: false })).toEqual([]);
  });

  it("validates each roster champion before pagination and totals", async () => {
    const entry = { id: "entry", playerId: "player", championId: 2, stars: 6, rank: 5, sigLevel: 200, isAwakened: true,
      isAscended: false, ascensionLevel: 0, powerRating: null, reservedForAttack: false,
      createdAt: date, updatedAt: date, champion: candidate() };
    vi.mocked(prisma.roster.findMany).mockResolvedValue([entry]);
    expect(await findSearchRoster("player", { immunities: "Bleed" })).toHaveLength(1);
    expect(await findSearchRoster("player", { immunities: "Bleed", minResistance: 65 })).toEqual([]);
  });
});
