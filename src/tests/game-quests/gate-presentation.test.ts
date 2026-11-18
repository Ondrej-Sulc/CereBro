import { describe, expect, it } from "vitest";
import type { QuestMap } from "../../domain/game-quests";
import type { QuestGate, QuestMapFeatureLayer } from "../../domain/game-quests/map-features";
import features from "../../data/game-quests/map-features.json";
import { projectQuestMapFeatures } from "../../../web/src/lib/game-quests/map-features";
import { questGateChampionGameIds, projectQuestGatePortraits } from "../../../web/src/lib/game-quests/gate-presentation";
import type { QuestPortrait } from "../../../web/src/lib/game-quests/presentation";
import { questTagGateLayout, QUEST_TAG_GATE_PADDING, QUEST_TAG_GATE_RADIUS } from "../../domain/game-quests/gate-tag-layout";

const layers = Object.values(features.maps) as unknown as QuestMapFeatureLayer[];
const gates = layers.flatMap(layer => layer.gates);
const blank: QuestMap = { version: 1, questId: "test", mapId: "test", sourceHash: "a".repeat(64), sourceFile: "test.json", capturedAt: "2026-11-18T00:00:00Z",
  gridDimension: 2, adaptive: false, tiles: [], paths: [], encounters: [], rewards: { fixedChampions: [], possibleCrystals: [] } };
function mapWith(...selected: QuestGate[]): QuestMap {
  return { ...blank, features: { ...layers[0], gates: selected, pathRewards: [] } };
}
function visual(gate: QuestGate, portraits: Record<string, QuestPortrait> = {}) {
  return projectQuestMapFeatures(mapWith(gate), portraits)[0].gates[0].visual!;
}
const portrait: QuestPortrait = { name: "Deathless Guillotine", href: "/champions/deathless-guillotine", imageUrl: "/portrait.png", className: "Mystic", color: "#9333ea",
  championBinding: { id: 50, gameId: "guillotine_nameless" } };

describe("source-bound quest gate visuals", () => {
  it("deduplicates exact blueprint variants and uses only exact champion portraits", () => {
    const gate = gates.find(gate => gate.constraints?.champions.includes("guillotine_nameless_t7"))!;
    expect(questGateChampionGameIds(mapWith(gate))).toEqual(["guillotine_nameless"]);
    expect(visual({ ...gate, label: "Misleading label" }, { guillotine_nameless: portrait })).toMatchObject({ kind: "champion", images: [{ src: "/portrait.png", label: "Deathless Guillotine" }], caption: "GUILLOTINE (DEATHLESS)" });
    expect(visual(gate, { guillotine_nameless: { ...portrait, championBinding: { id: 50, gameId: "vision_deathless" } } }).images).toEqual([]);
    expect(visual(gate, { guillotine_nameless: { ...portrait, championBinding: undefined } }).images).toEqual([]);
  });

  it("keeps distinct allowed champions as OR alternatives and rejects unknown blueprints", () => {
    const sample = gates.find(gate => gate.kind === "champion")!;
    const gate = { ...sample, constraints: { ...sample.constraints!, champions: ["guillotine_nameless_t7", "vision_deathless_t7"], championLogic: "any" as const } };
    const actual = visual(gate, { guillotine_nameless: portrait, vision_deathless: { ...portrait, name: "Deathless Vision", imageUrl: "/vision.png", championBinding: { id: 51, gameId: "vision_deathless" } } });
    expect(actual.images.map(image => image.src)).toEqual(["/portrait.png", "/vision.png"]);
    expect(actual.caption).toBe("GUILLOTINE (DEATHLESS) or VISION (DEATHLESS)");
    const unknown = { ...gate, constraints: { ...gate.constraints, champions: ["guillotine_nameless_invented"] } };
    expect(questGateChampionGameIds(mapWith(unknown))).toEqual([]);
    expect(visual(unknown).kind).toBe("unknown");
  });

  it("projects native class IDs, counts, and rarity from constraints without parsing labels", () => {
    const sample = gates.find(gate => gate.kind === "class")!;
    const gate = { ...sample, label: "Tech, 1 star", constraints: { nativeType: "hasClass", champions: [], class: "trained", count: 3, countOperator: "gte" } };
    expect(visual(gate)).toEqual({ kind: "class", images: [{ src: "/assets/icons/Skill.png", label: "Skill" }], className: "Skill", color: "#ef4444", countLabel: "≥3", caption: "Skill champions" });
    const combined = { ...gate, kind: "class-and-rarity" as const, constraints: { ...gate.constraints, nativeType: "hasClassAndRarity", rarity: "t7" } };
    expect(visual(combined)).toMatchObject({ kind: "class", className: "Skill", rarity: 7, countLabel: "≥3", caption: "7★ Skill champions" });
    const rarity = gates.find(gate => gate.kind === "rarity")!;
    expect(visual(rarity)).toMatchObject({ kind: "rarity", rarity: 7 });
  });

  it("preserves OR groups, AND terms, and negation in tag captions", () => {
    const sample = gates.find(gate => gate.kind === "tags")!;
    const tagged = (tags: string[]) => ({ ...sample, constraints: { ...sample.constraints!, tags } });
    expect(visual(tagged(["chemical", "tech"]))).toMatchObject({ kind: "tags", images: [{ src: "/assets/icons/Science.png", label: "Science" }, { src: "/assets/icons/Tech.png", label: "Tech" }], caption: "#Science or #Tech" });
    expect(visual(tagged(["tg_vill:tg_gam"]))).toMatchObject({ kind: "tags", images: [], caption: "#Villain and #Gamma", tagGroups: [[{ label: "Villain", negated: false }, { label: "Gamma", negated: false }]] });
    expect(visual(tagged(["tg_2015:!tg_met"])).caption).toBe("#2015 and not #Metal");
    expect(visual(tagged(["cosmic:tg_hero:typ_def_uti"])).images).toEqual([]);
    expect(visual(tagged(["unknown_tech_tag"])).kind).toBe("unknown");
  });

  it("retains complete tag groups, exclusions and labels inside the reserved map footprint", () => {
    for (const gate of gates.filter(gate => gate.kind === "tags")) {
      const actual = visual(gate);
      if (actual.images.length) { expect(actual.tagGroups).toBeUndefined(); continue; }
      expect(actual.tagGroups!.map(group => group.length)).toEqual(gate.constraints!.tags!.map(group => group.split(":").length));
      const layout = questTagGateLayout(actual.tagGroups!);
      const content = layout.rows.map(row => row.text).join(" ");
      for (const group of actual.tagGroups!) for (const term of group) expect(content).toContain(`${term.negated ? "not " : ""}#${term.label}`);
      expect(content).not.toContain("…");
      expect(Math.hypot(layout.width / 2 + 5, layout.height / 2 + 5), gate.id).toBeLessThanOrEqual(QUEST_TAG_GATE_RADIUS);
      expect(layout.width / 2 + 10).toBeLessThanOrEqual(QUEST_TAG_GATE_PADDING);
      expect(layout.height / 2 + 10).toBeLessThanOrEqual(QUEST_TAG_GATE_PADDING);
    }
  });

  it("shows exact resource names, quantities, and available native artwork", () => {
    const resource = gates.filter(gate => gate.kind === "resource");
    const vault = resource.find(gate => gate.constraints?.costs?.[0].data === "grandmaster_gauntlet_key_jan2023")!;
    expect(visual(vault)).toMatchObject({ kind: "resource", countLabel: "×1", caption: "GRANDMASTER'S VAULT KEY" });
    const essence = resource.find(gate => gate.constraints?.costs?.[0].data === "carina_corrupted_essence_story_key")!;
    expect(visual(essence)).toMatchObject({ kind: "resource", countLabel: "×3", caption: "The Chronoserpent's Essence", images: [{ label: "The Chronoserpent's Essence", src: expect.stringMatching(/^\/game-quests\/path-reward-art\//) }] });
    const shard = resource.find(gate => gate.constraints?.costs?.[0].data === "chronoserpent_epilogue_key")!;
    expect(visual(shard)).toMatchObject({ kind: "resource", countLabel: "×5", caption: "PURIFIED TEMPORAL SHARD", images: [{ label: "PURIFIED TEMPORAL SHARD", src: expect.stringMatching(/^\/game-quests\/path-reward-art\//) }] });
  });

  it("limits gate database portraits to exact requested identities and rejects duplicate bindings", () => {
    const gate = gates.find(gate => gate.constraints?.champions.includes("guillotine_nameless_t7"))!;
    const map = mapWith(gate);
    const row = { id: 50, gameId: "guillotine_nameless", name: "Deathless Guillotine", slug: "deathless-guillotine", images: { p_128: "/portrait.png" }, class: "MYSTIC" as const };
    expect(projectQuestGatePortraits(map, [row])).toMatchObject({ guillotine_nameless: { championBinding: { id: 50, gameId: "guillotine_nameless" } } });
    expect(projectQuestGatePortraits(map, [row, { ...row }])).toEqual({});
    expect(projectQuestGatePortraits(map, [{ ...row, gameId: "guillotine" }])).toEqual({});
    expect(projectQuestGatePortraits(map, [{ ...row, id: 0 }])).toEqual({});
  });

  it("projects all 99 positioned published gates without unknown requirements or changing map data", () => {
    const before = JSON.stringify(features);
    expect(gates).toHaveLength(99);
    expect(gates.reduce<Record<string, number>>((counts, gate) => { counts[gate.kind] = (counts[gate.kind] ?? 0) + 1; return counts; }, {})).toEqual({ tags: 40, class: 29, rarity: 18, champion: 9, resource: 3 });
    for (const gate of gates) {
      const actual = visual(gate);
      expect(actual.kind, gate.id).not.toBe("unknown");
      expect(actual.caption, gate.id).toBeTruthy();
    }
    expect(questGateChampionGameIds(mapWith(...gates))).toEqual(["carina_white", "groot_king_deathless", "guillotine_nameless", "shehulk_deathless", "vision_deathless"]);
    expect(JSON.stringify(features)).toBe(before);
  });
});
