import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { loadTowerBlock, towerBackendIndex } from "@cerebro/core/data/game-quests/tower-backend";
import { loadTowerBlock as loadChallengeBlock, towerChallengeIndex } from "@cerebro/core/data/game-quests/tower-challenges";
import { loadTowerBlock as loadEventBlock, towerEventIndex } from "@cerebro/core/data/game-quests/tower-events";
import { projectTowerDefender, projectTowerModifiers, projectTowerRewards, cleanTowerText, towerPresentation } from "./presentation";
import { getTowerCatalog, getTowerBlockView } from "./index";
import { towerChampionGameIds } from "./champions";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: mocks.findMany } } }));
vi.mock("@/lib/cache", () => ({ getFromCache: (_key: string, _ttl: number, fetch: () => unknown) => fetch() }));
beforeEach(() => { mocks.findMany.mockReset(); mocks.findMany.mockResolvedValue([]); });

describe("Tower source presentation", () => {
  it("loads every configured Event block with native full HP and separate reward scopes", async () => {
    const events = (await getTowerCatalog()).filter(t => t.section === "event");
    expect(events.map(t => t.id)).toEqual(["event_castellan_5", "event_ggsfa1"]);
    expect(events[0]).toMatchObject({ name: "DOOM TOWER", floorCount: 61, endsAt: "2026-11-18T18:00:00Z", capturedBlockNumbers: [1,2,3,4,5,6,7,8,9,10] });
    expect(events[1]).toMatchObject({ floorCount: 2, endsAt: "2026-12-09T18:00:00Z", capturedBlockNumbers: [1,2] });
    let floors = 0;
    for (const tower of events) for (const blockNumber of tower.blockNumbers) {
      const native = (await loadEventBlock(tower.id, blockNumber))!;
      const view = (await getTowerBlockView(tower.id, blockNumber))!;
      expect(view.floors).toHaveLength(native.declaredFloorCount);
      floors += view.floors.length;
      for (let i=0; i<view.floors.length; i++) {
        expect(view.floors[i].defender).toMatchObject(native.floors[i].defender!);
        expect(view.floors[i].defender!.health).toBe(1);
        expect(view.floors[i].defender!.fullHealth).toBeGreaterThan(1);
        expect(view.floors[i].defender!.fullHealth).toBe(native.floors[i].defender!.maxHealth);
        expect(view.floors[i].defender!.name).not.toBe("Recorded defender");
      }
      expect(view.blockRewards.every(r => r.scope === "Block rewards")).toBe(true);
      expect(view.entryCost.every(r => r.scope === "Entry cost")).toBe(true);
    }
    expect(floors).toBe(63);
  });
  it("shows native artwork for named Tower-only inventory rewards", () => {
    for (const token of ["rankup_epic1_chemical", "refined_xp_token", "saga_tooth_and_claw_rankup_t71"]) {
      const [reward] = projectTowerRewards([{ t: "inv", n: token, q: 1 }], "tower:example:block:1:rewards", "Block rewards");
      expect(reward.imageUrl, token).toBeTruthy();
    }
  });
  it("exposes exactly six configured Class Towers and the captured Saga catalog", async () => {
    const catalog = await getTowerCatalog();
    expect(catalog.filter(t => t.section === "class")).toHaveLength(6);
    for (const t of catalog.filter(t => t.section === "class")) {
      expect(t.blockNumbers).toEqual(Array.from({ length: 147 }, (_, i) => i + 1));
      expect(t.floorCount).toBe(1606);
      expect(t.artwork).toMatchObject({ width: 326, height: 659 });
    }
    expect(catalog.filter(t => t.section === "challenge").map(t => t.id)).toEqual(towerChallengeIndex.towers.map(t => t.id));
    expect(catalog.find(t => t.id === "challenge_saga")).toMatchObject({ floorCount: 44, blockNumbers: [1,2,3,4,5,6], archiveStatus: "unknown" });
  });

  it("rejects unknown and traversal IDs, missing blocks and noninteger values", async () => {
    for (const [id, n] of [["missing", 1], ["../class_mutant", 1], ["class_mutant", 0], ["class_mutant", 148], ["class_mutant", 1.5], ["class_mutant", NaN], ["challenge_saga", 7]] as const) {
      expect(await getTowerBlockView(id, n)).toBeNull();
    }
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("keeps floor, block, rating rewards and costs distinct with stable Tower keys", async () => {
    const view = (await getTowerBlockView("class_cosmic", 1))!;
    expect(view.blockRewards).toHaveLength((view.block.blockData.rewards as unknown[]).length);
    expect(view.ratingRewards).toHaveLength(2);
    expect(view.entryCost).toEqual([]);
    expect(view.floors[0].rewards).toHaveLength(3);
    expect(view.floors[0].rewards[0]).toMatchObject({ name: "Gold", quantity: 4000, scope: "Floor rewards" });
    const rewards = [...view.blockRewards, ...view.ratingRewards, ...view.floors[0].rewards];
    expect(new Set(rewards.map(r => r.key)).size).toBe(rewards.length);
    expect(rewards.every(r => r.key.startsWith("tower:class_cosmic:block:1:"))).toBe(true);
    expect(rewards.every(r => !/explor|mastery|quest/i.test(r.scope))).toBe(true);
  });

  it("performs one exact, batched playable gameId lookup for defenders and champion rewards", async () => {
    mocks.findMany.mockResolvedValue([{ gameId: "starlord", name: "Star-Lord", slug: "star-lord", class: "TECH", images: { p_128: "https://example.test/starlord.webp" } }]);
    const block = (await loadTowerBlock("class_cosmic", 1))!;
    const view = (await getTowerBlockView("class_cosmic", 1))!;
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ gameId: { in: towerChampionGameIds(block) }, isPlayable: true });
    expect(towerChampionGameIds(block)).toContain("drax");
    expect(view.floors[0].defender).toMatchObject({ name: "Star-Lord", className: "Tech", href: "/champions/star-lord", imageUrl: "https://example.test/starlord.webp" });
  });

  it("preserves high native enemy ascension and exact stats", async () => {
    const view = (await getTowerBlockView("class_mutant", 147))!;
    const native = (await loadTowerBlock("class_mutant", 147))!;
    expect(view.floors).toHaveLength(native.declaredFloorCount);
    expect(view.floors.some(f => f.defender!.ascensionTier! > 2)).toBe(true);
    for (let i=0; i<view.floors.length; i++) {
      expect(view.floors[i].defender).toMatchObject(native.floors[i].defender!);
      expect(view.floors[i].defender!.fullHealth).toBe(native.floors[i].defender!.maxHealth);
    }
  });

  it("uses maximum HP as full enemy health in the actual Saga source with current HP 1", async () => {
    const native = (await loadChallengeBlock("challenge_saga", 1))!;
    const index = native.floors.findIndex(f => f.defender?.health === 1 && f.defender?.maxHealth === 94110);
    expect(index).toBeGreaterThanOrEqual(0);
    const view = (await getTowerBlockView("challenge_saga", 1))!;
    expect(view.floors[index].defender).toMatchObject({ health: 1, maxHealth: 94110, fullHealth: 94110 });
    expect(view.floors[index].sourceData).toEqual(native.floors[index].sourceData);
  });

  it("keeps node-sourced text separate from an unproved Tower icon transfer", () => {
    const [v] = projectTowerModifiers([{ t: "buff", n: "avx_hp_pct3000", q: 1 }], "Block modifiers");
    expect(v).toMatchObject({ name: "Health", description: "+3000% Health", quantity: 1, sourceScope: "Block modifiers", iconKey: null, condition: null, persistence: null });
    const [differentQuantity] = projectTowerModifiers([{ t: "buff", n: "avx_hp_pct3000", q: 7 }], "Floor rules");
    expect(differentQuantity.quantity).toBe(7);
    expect(differentQuantity.description).toBeNull();
  });

  it("retains icons only for the two observed complete matching Tower definitions", () => {
    const bound = Object.entries(towerPresentation.modifiers).filter(([, d]) => d.iconKey !== null).map(([id]) => id).sort();
    expect(bound).toEqual(["avx_hp_pct2000", "avx_hp_pct400"]);
    for (const id of bound) expect(projectTowerModifiers([{ t: "buff", n: id, q: 1 }], "Block rules")[0].iconKey).toBe("node-glyph-e101e5101ef5c624");
  });

  it("keeps missing definitions, malformed quantities and same-ID nonbuff records unbound", () => {
    const rows = projectTowerModifiers([{ t: "buff", n: "unknown_secret_id", q: 3 }, { t: "item", n: "avx_hp_pct3000", q: 1 }, { t: "buff", n: "avx_hp_pct3000", q: "1" }], "Floor rules");
    expect(rows[0]).toMatchObject({ id: "unknown_secret_id", name: "Recorded modifier", description: null, iconKey: null, quantity: 3 });
    expect(rows[1]).toMatchObject({ name: "Recorded modifier", iconKey: null });
    expect(rows[2]).toMatchObject({ quantity: null, description: null });
    expect(rows[0].sourceData).toEqual({ t: "buff", n: "unknown_secret_id", q: 3 });
  });

  it("never guesses blueprint names, rarity or aliases from unknown reward suffixes", () => {
    const [r] = projectTowerRewards([{ t: "hero", n: "starlord_fictional_7star", q: 0 }], "tower:x:block:1:rewards", "Block rewards");
    expect(r).toMatchObject({ name: "Recorded champion", imageUrl: null, href: null, quantity: 0, amount: "×0", type: "champion" });
    expect(r.rarity).toBeUndefined();
  });

  it("keeps unknown and legacy enemy blueprints distinct from playable champions", async () => {
    const native = (await loadTowerBlock("class_cosmic", 1))!.floors[0].defender!;
    const result = projectTowerDefender({ ...native, blueprint: "starlord_fictional_variant", gameId: null, rarity: null, classId: null, ascensionTier: 11 }, {
      starlord: { name: "Star-Lord", href: "/champions/star-lord", imageUrl: "https://example.test/portrait.webp", className: "Tech", color: "blue" },
    });
    expect(result).toMatchObject({ name: "Recorded defender", href: null, imageUrl: null, rarity: null, className: "Unknown class", ascensionTier: 11 });
    expect(projectTowerDefender(null, {})).toBeNull();
  });

  it("uses canonical crystal links, distinct shard/material types and honest unknowns", () => {
    const rows = projectTowerRewards([{ t: "gs", n: "7_star_mutant_hero_crystal", q: 1 }, { t: "gf", n: "7_star_hero_shard_crystal", q: 2000 }, { t: "ebpf", n: "t7_generic", q: 100 }, { t: "unmapped", n: "raw_internal", q: 7 }], "tower:x:block:1:rewards", "Block rewards");
    expect(rows[0].href).toMatch(/^\/crystals\//);
    expect(rows[0].type).toBe("crystal");
    expect(rows[1].type).toBe("item");
    expect(rows[2].name.toLowerCase()).toContain("fragments");
    expect(rows[3]).toMatchObject({ name: "Recorded reward", token: "raw_internal", quantity: 7, recordedOutcome: true });
  });

  it("cleans escaped native newlines and only known native rich-text markup", () => {
    expect(cleanTowerText("[16982bff]Rule[-]\\n[k=glossary/power]Power[/k] {0}")).toBe("Rule\nPower {0}");
  });

  it("presents observed native Tower rules with formatted duration and no unproved icon transfer", () => {
    const [timer, power, attack] = projectTowerModifiers([
      { t: "buff", n: "towers_rule_timer_1m", q: 1 }, { t: "buff", n: "towers_rule_dmg", q: 1 }, { t: "buff", n: "avx_atk_pct200", q: 1 },
    ], "Block rules");
    expect(timer).toMatchObject({ name: "Race to the Finish - 1 Minute", iconKey: null });
    expect(timer.description).toContain("60 second timer");
    expect(timer.description).not.toMatch(/\{\d+\}/);
    expect(power.description).toContain("\n •");
    expect(power.description).not.toContain("\\n");
    expect(power.iconKey).toBeNull();
    expect(attack).toMatchObject({ name: "Attack", description: "+200% Attack", iconKey: null });
  });

  it("covers every exact defender and reward join in the complete published corpus", async () => {
    const manifests = [[towerBackendIndex, "tower-backend"], [towerChallengeIndex, "tower-challenges"], [towerEventIndex, "tower-events"]] as const;
    for (const [manifest, packageName] of manifests) {
      for (const b of Object.values(manifest.blocks)) {
        const block = JSON.parse(readFileSync(`src/data/game-quests/${packageName}/${b.path}`, "utf8"));
        for (const floor of block.floors) if (floor.defender?.gameId) expect(towerPresentation.champions[floor.defender.gameId]?.name).toBeTruthy();
        for (const source of [block.blockData, ...block.floors.map((f: { sourceData: unknown }) => f.sourceData)]) {
          for (const field of ["rewards", "ratingRewards", "floorCost"]) {
            for (const reward of source[field] ?? []) expect(towerPresentation.rewards[`${reward.t}:${reward.n}`]).toBeDefined();
          }
        }
      }
    }
  });
});
