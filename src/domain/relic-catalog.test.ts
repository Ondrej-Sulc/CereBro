import { describe, it, expect } from "vitest";
import {
  parseRelicCatalog,
  buildRelicFamilies,
  selectableRelicRarities,
  resolveRelicDescription,
  filterRelicFamilies,
} from "./relic-catalog";

const rarity = (id: string, stars: number, index: number) => ({
  id,
  stars,
  sourceOrderIndex: index,
  maxRank: stars - 1,
  maxSignature: 200,
});
const item = {
  id: "striker_antman",
  name: "Ant-Man",
  type: "striker",
  classId: "chemical",
  innateOnly: true,
  descriptionTemplate: "Damage {damage.a} over {time.b}s.",
  unequippedDescriptionTemplate: "",
  commonStatModIds: [],
  tieredStatModIds: ["damage", "time"],
  placeholders: [
    { token: "damage.a", tieredId: "damage", parameter: "a" },
    { token: "time.b", tieredId: "time", parameter: "b" },
  ],
};
const relic = {
  id: "relic_antman_offense",
  name: "Ant-Man Battlecast",
  shortName: "Ant-Man",
  type: "battlecast",
  classId: "chemical",
  className: "Science",
  descriptionTemplate: "",
  rarities: [rarity("rar", 3, 0), rarity("leg", 5, 1)],
  restrictionSelectors: [],
  recommendedChampions: [],
  innateSocketItemIds: [item.id],
  slots: [],
  unlockConfigurationId: "config",
  portraitAsset: "relic_portrait_antman",
  smallPortraitAsset: "relic_portrait_small_antman",
  modelAsset: "AntMan",
  baseModelAsset: "",
  statcastPrimaryAttribute: null,
  statcastSecondaryAttribute: null,
  supportCombatRateMultipliers: [],
  availability: "cached",
};
const statcast = {
  ...relic,
  id: "relic_statcast_one",
  type: "statcast",
  name: "Sturdy Mutant Relic",
  shortName: "Apocalypse",
  classId: "mutant",
  className: "Mutant",
  modelAsset: "Apocalypse_SC",
  statcastPrimaryAttribute: "Critical Resistance",
  statcastSecondaryAttribute: "Armor",
  rarities: [
    rarity("rar", 3, 0),
    rarity("ep", 4, 1),
    rarity("leg", 5, 2),
    rarity("t6", 6, 3),
    rarity("t7", 7, 4),
  ],
};
const fixture = () =>
  structuredClone({
    metadata: {
      schemaVersion: "mcoc-relic-data-v1",
      generatedAt: "2026-10-18T18:31:20Z",
      counts: { Relics: 3, SocketItems: 1 },
    },
    relics: [
      relic,
      statcast,
      {
        ...statcast,
        id: "relic_statcast_two",
        statcastSecondaryAttribute: "Energy Resistance",
      },
    ],
    socketItems: [item],
  });
describe("relic catalog", () => {
  it("keeps distinct Statcast source IDs and all source rarities", () => {
    const data = parseRelicCatalog(fixture());
    expect(data.relics).toHaveLength(3);
    expect(data.relics[1].rarities).toHaveLength(5);
  });
  it("exposes only 5-star+ Statcasts without changing source order or indexing", () => {
    const data = parseRelicCatalog(fixture());
    expect(
      selectableRelicRarities(data.relics[1]).map((r) => [
        r.stars,
        r.sourceOrderIndex,
      ]),
    ).toEqual([
      [5, 2],
      [6, 3],
      [7, 4],
    ]);
    expect(selectableRelicRarities(data.relics[0]).map((r) => r.stars)).toEqual(
      [3, 5],
    );
  });
  it("preserves a recorded 7-star Battlecast such as The Cosmic Egg", () => {
    const data = fixture();
    data.relics[0].rarities.push(rarity("t7", 7, 2));
    expect(
      selectableRelicRarities(parseRelicCatalog(data).relics[0]).map(
        (r) => r.stars,
      ),
    ).toEqual([3, 5, 7]);
  });
  it("groups families for display while keeping both variants", () => {
    const families = buildRelicFamilies(parseRelicCatalog(fixture()).relics);
    expect(families).toHaveLength(2);
    expect(
      families.find((f) => f.type === "statcast")?.variants.map((v) => v.id),
    ).toEqual(["relic_statcast_one", "relic_statcast_two"]);
  });
  it("does not combine Battlecasts sharing artwork", () => {
    const data = fixture();
    data.relics[1] = { ...relic, id: "another", name: "Another" };
    expect(buildRelicFamilies(parseRelicCatalog(data).relics)).toHaveLength(3);
  });
  it("filters variants on the same definition rather than mixing primary/secondary matches", () => {
    const families = buildRelicFamilies(parseRelicCatalog(fixture()).relics);
    expect(
      filterRelicFamilies(families, {
        query: "",
        type: "statcast",
        className: "Mutant",
        attribute: "Energy Resistance",
      })
        .flatMap((f) => f.variants)
        .map((v) => v.id),
    ).toEqual(["relic_statcast_two"]);
    expect(
      filterRelicFamilies(families, {
        query: "ant-man",
        type: "all",
        className: "all",
        attribute: "all",
      }),
    ).toHaveLength(1);
  });
  it("rejects duplicate source IDs", () => {
    const data = fixture();
    data.relics[2].id = data.relics[1].id;
    expect(() => parseRelicCatalog(data)).toThrow(/Duplicate/);
  });
  it("rejects broken socket-item references", () => {
    const data = fixture();
    data.relics[0].innateSocketItemIds = ["missing"];
    expect(() => parseRelicCatalog(data)).toThrow(/socket/i);
  });
  it("preserves explicit slot positions and ordered options", () => {
    const data = fixture();
    Object.assign(data.relics[0], {
      slots: [
        {
          index: 4,
          sourceSelector: "x",
          type: "ability",
          classId: "x",
          socketItemIds: [item.id],
        },
      ],
    });
    expect(parseRelicCatalog(data).relics[0].slots[0].index).toBe(4);
  });
  it("rejects repeated positions instead of compacting them", () => {
    const data = fixture();
    const slot = {
      index: 4,
      sourceSelector: "x",
      type: "ability",
      classId: "x",
      socketItemIds: [item.id],
    };
    Object.assign(data.relics[0], { slots: [slot, slot] });
    expect(() => parseRelicCatalog(data)).toThrow(/slot/i);
  });
  it("rejects manifest count drift and unsupported versions", () => {
    const data = fixture();
    data.metadata.counts.Relics = 2;
    expect(() => parseRelicCatalog(data)).toThrow(/count/i);
    data.metadata.schemaVersion = "v2";
    expect(() => parseRelicCatalog(data)).toThrow();
  });
  it("renders only proven literal parameters, not the minimum or maximum of a scaled amount", () => {
    const context = {
      parameters: {
        damage: {
          a: {
            minAtRarity: "0.032",
            maxAtRarity: "0.064",
            usesChallengeRating: false,
            exponent: 1.75,
          },
        },
        time: {
          b: { constantRaw: "16", usesChallengeRating: false, exponent: 0 },
        },
      },
    };
    expect(resolveRelicDescription(item.descriptionTemplate, context)).toEqual([
      { text: "Damage " },
      { text: "Build-dependent", unresolved: true },
      { text: " over " },
      { text: "16" },
      { text: "s." },
    ]);
  });
  it("keeps missing, champion-dependent and unsupported expressions explicit", () => {
    expect(
      resolveRelicDescription("{time.b} {other.a}", {
        parameters: {
          time: {
            b: { constantRaw: "5", usesChallengeRating: true, exponent: 0 },
          },
        },
      }).filter((p) => p.unresolved),
    ).toHaveLength(2);
    expect(resolveRelicDescription("0.5 seconds.", undefined)).toEqual([
      { text: "0.5 seconds." },
    ]);
  });
});
