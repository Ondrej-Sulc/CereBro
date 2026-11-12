/** Offline, deterministic projection. Reads the accepted public catalogs only. */
import { questCatalog, loadQuestMap } from "../game-quests";
import { permanentData } from "../game-quests/permanent";
import { getQuestRewardRecord, getParentRewardRecord, type QuestRewardRecord, type NativeQuestReward } from "../game-quests/rewards";
import { loadQuestSpawnRegions } from "../game-quests/spawn-regions";
import { towerBackendIndex, loadTowerBlock } from "../game-quests/tower-backend";
import { towerChallengeIndex, loadTowerBlock as loadChallenge } from "../game-quests/tower-challenges";
import { towerEventIndex, loadTowerBlock as loadEvent } from "../game-quests/tower-events";
import towerPresentation from "../game-quests/tower-presentation/catalog.json";
import towerSources from "../game-quests/tower-presentation/sources.json";
import nodeIndex from "../game-node-modifiers/v2/index.json";
import portraitNames from "../game-node-modifiers/v2/portraits.json";
import { nativeModifierHref } from "../game-node-modifiers/links";
import { coordinateKey, hierarchyLabel, type QuestSummary } from "../../domain/game-quests";
import { rewardIdentity, type GameDiscovery, type DiscoveryLocation, type DiscoverySection } from "../../domain/game-discovery";

const grants = new Set(["hero", "gs", "gf", "res", "ebp", "ebpf", "inv", "sra", "utitle", "profilebadge", "emote"]);
const titleCase = (text: string) => text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const nativeRows = (value: unknown) => Array.isArray(value) ? value.filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r)) : [];
const namesById = portraitNames.bindings as Record<string, { public?: { name?: string } | null }>;
const defenderName = (id: string, fallback: string) => portraitNames.bcgSha256 === nodeIndex.profile.bcgSha256 ? namesById[id]?.public?.name ?? fallback : fallback;

export async function buildDiscovery(): Promise<GameDiscovery> {
  const result: GameDiscovery = { version: 1, nodeCatalogHash: nodeIndex.catalogHash, coverage: { quests: 0, towerBlocks: 0 }, nodes: {}, rewards: {} };
  const nodeDestinations = new Map<string, Set<string>>();
  const addNode = (id: string, row: DiscoveryLocation) => {
    const seen = nodeDestinations.get(id) ?? new Set<string>();
    if (!seen.has(row.href)) (result.nodes[id] ??= []).push(row);
    seen.add(row.href); nodeDestinations.set(id, seen);
  };
  const addReward = (reward: NativeQuestReward, scope: string, location: DiscoveryLocation, key: string) => {
    if (!grants.has(reward.type) || !reward.data || reward.data === "unknown_rewards") return;
    const identity = rewardIdentity(reward.type, reward.data);
    const entry = result.rewards[identity] ??= { type: reward.type, token: reward.data, sample: reward, sources: [] };
    entry.sources.push({ ...location, key, scope, quantity: reward.quantity,
      ...(reward.minQuantity !== undefined ? { minQuantity: reward.minQuantity } : {}),
      ...(reward.maxQuantity !== undefined ? { maxQuantity: reward.maxQuantity } : {}) });
  };
  const addRecord = (record: QuestRewardRecord | undefined, location: DiscoveryLocation, anchor: string) => {
    if (!record) return;
    for (const [scope, rewards] of Object.entries(record.scopes)) for (const reward of rewards) {
      addReward(reward, scope, { ...location, href: `${location.href}#${anchor}-${scope}` }, `${record.key}:${scope}:${reward.sourceIndex}`);
    }
  };
  const parents = new Map<string, { kind: "act" | "chapter"; id: string; quests: QuestSummary[] }>();
  for (const q of questCatalog) {
    const section = q.section === "Special" ? "Special" : "Story";
    const title = section === "Story" ? `${hierarchyLabel(q)} · ${q.name}` : `${permanentData.specialCollections[q.containerSetName] ?? "Special quest"} · ${q.name}${q.difficulty ? ` · ${q.difficulty}` : ""}`;
    const location: DiscoveryLocation = { title, context: "", section, href: `/quests/${encodeURIComponent(q.id)}` };
    addRecord(getQuestRewardRecord(q), location, "quest-rewards");
    for (const h of q.hierarchy) for (const kind of ["act", "chapter"] as const) {
      const id = kind === "act" ? h.actId : h.chapterId;
      const key = JSON.stringify([q.containerSetId, h.actId, kind, id]);
      const parent = parents.get(key) ?? { kind, id, quests: [] };
      parent.quests.push(q); parents.set(key, parent);
    }
    const map = await loadQuestMap(q.id);
    if (!map) continue;
    result.coverage.quests++;
    for (const e of map.encounters) {
      const tile = map.tiles.find(t => coordinateKey(t.coordinate) === coordinateKey(e.coordinate));
      const seen = new Set<string>();
      for (const a of tile?.applications ?? []) {
        if (!a.definitionHref || seen.has(a.effectId)) continue;
        seen.add(a.effectId);
        const params = new URLSearchParams({ node: coordinateKey(e.coordinate), sourceHash: map.sourceHash });
        if (e.pathIndices.length) params.set("path", String(e.pathIndices[0]));
        addNode(a.effectId, { ...location, context: `${defenderName(e.gameId, e.name)} · ${e.rarity}★${e.final ? " · Boss" : ""}`, href: `${location.href}?${params}#coordinate-heading` });
      }
    }
    const regions = await loadQuestSpawnRegions(map);
    for (const region of regions?.regions ?? []) {
      const tile = map.tiles.find(t => coordinateKey(t.coordinate) === coordinateKey(region.anchor));
      const seen = new Set<string>();
      for (const a of tile?.applications ?? []) {
        if (!a.definitionHref || seen.has(a.effectId)) continue;
        // Region-wide claims require the same assignment on every possible tile.
        if (!region.coordinates.every(c => map.tiles.find(t => coordinateKey(t.coordinate) === coordinateKey(c))?.applications.some(other => other.effectId === a.effectId && other.definitionHref === a.definitionHref && other.description === a.description))) continue;
        seen.add(a.effectId);
        const params = new URLSearchParams({ region: region.id });
        if (region.pathIndices.length) params.set("path", String(region.pathIndices[0]));
        addNode(a.effectId, { ...location, context: `${defenderName(region.defender.gameId, region.defender.name)} · ${region.defender.rarity}★ · Encounter region`, href: `${location.href}?${params}#coordinate-heading` });
      }
    }
  }
  for (const parent of parents.values()) {
    const q = parent.quests[0], h = q.hierarchy.find(h => parent.kind === "act" ? h.actId === parent.id : h.chapterId === parent.id)!;
    const record = getParentRewardRecord(parent.quests, parent.kind, parent.id);
    const section = q.section === "Special" ? "Special" : "Story";
    const params = new URLSearchParams(section === "Special" ? { category: "Special", collection: q.containerSetName } : { category: "Story", act: h.actId });
    if (parent.kind === "chapter") params.set("chapter", h.chapterId);
    const group = section === "Special" ? permanentData.specialCollections[q.containerSetName] : `Act ${q.actIndex}`;
    addRecord(record, { title: `${group}${parent.kind === "chapter" ? ` · Chapter ${q.chapterIndex}: ${h.chapterName}` : ""}`, context: parent.kind === "act" ? "Act rewards" : "Chapter rewards", section, href: `/quests?${params}` }, `${parent.kind}-rewards`);
  }
  const towers = [
    ...permanentData.towers.map(t => ({ id: t.id, name: t.name, section: "Class Tower" as const, index: towerBackendIndex, load: loadTowerBlock })),
    ...towerChallengeIndex.towers.map(t => ({ ...t, section: "Challenge Tower" as const, index: towerChallengeIndex, load: loadChallenge })),
    ...towerEventIndex.towers.map(t => ({ ...t, section: "Event Tower" as const, index: towerEventIndex, load: loadEvent })),
  ];
  const proofs = towerSources as unknown as { bcgSha256: string; modifierProofs: Record<string, { versionHash?: string }> };
  const rewardDefinitions = towerPresentation.rewards as Record<string, { displayName?: string; gameId?: string; rarity?: number }>;
  const names = towerPresentation.champions as Record<string, { name?: string }>;
  for (const tower of towers) for (const ref of Object.values(tower.index.blocks).filter(b => b.towerId === tower.id).sort((a, b) => a.blockNumber - b.blockNumber)) {
    const block = await tower.load(tower.id, ref.blockNumber);
    if (!block) throw new Error(`Missing public Tower block: ${tower.id}:${ref.blockNumber}`);
    result.coverage.towerBlocks++;
    const section: DiscoverySection = tower.section;
    const location: DiscoveryLocation = { title: `${titleCase(tower.name)} · Block ${ref.blockNumber}`, context: "", section, href: `/quests/towers/${encodeURIComponent(tower.id)}?block=${ref.blockNumber}` };
    const addTowerNodes = (value: unknown, context: string, anchor: string) => {
      for (const row of nativeRows(value)) {
        if (row.t !== "buff" || typeof row.n !== "string" || !nativeModifierHref(row.n, proofs.modifierProofs[row.n]?.versionHash, proofs.bcgSha256)) continue;
        addNode(row.n, { ...location, context, href: `${location.href}&modifier=${encodeURIComponent(row.n)}#${anchor}` });
      }
    };
    const addTowerRewards = (value: unknown, scope: string, context: string, anchor: string, floor?: number) => {
      for (const [i, row] of nativeRows(value).entries()) {
        if (typeof row.t !== "string" || typeof row.n !== "string" || typeof row.q !== "number") continue;
        const definition = rewardDefinitions[`${row.t}:${row.n}`];
        const sample: NativeQuestReward = { sourceIndex: i, type: row.t, data: row.n, quantity: row.q,
          displayName: (definition?.gameId ? names[definition.gameId]?.name : undefined) ?? definition?.displayName,
          ...(definition?.gameId && definition.rarity ? { identity: { tierId: row.n, gameId: definition.gameId, rarity: definition.rarity, name: names[definition.gameId]?.name ?? "Champion", champion: null } } : {}) };
        addReward(sample, scope, { ...location, context, href: `${location.href}${floor ? `&rewardFloor=${floor}` : ""}#${anchor}` }, `${tower.id}:${ref.blockNumber}:${floor ?? "block"}:${scope}:${i}`);
      }
    };
    for (const field of ["topBuffs", "buffs"]) addTowerNodes(block.blockData[field], "Block rules", "block-rules");
    addTowerRewards(block.blockData.rewards, "Block rewards", "Block rewards", "block-rewards");
    // gsi records lack established rating conditions; they are not advertised as earnable prizes.
    for (const f of block.floors) {
      const name = f.defender?.gameId ? defenderName(f.defender.gameId, names[f.defender.gameId]?.name ?? "Defender") : undefined;
      const context = `Floor ${f.floorNumber}${name ? ` · ${name}` : ""}`;
      for (const field of ["topBuffs", "buffs"]) addTowerNodes(f.sourceData[field], context, `floor-${f.floorNumber}`);
      addTowerRewards(f.sourceData.rewards, "Floor rewards", context, `floor-${f.floorNumber}`, f.floorNumber);
    }
  }
  result.nodes = Object.fromEntries(Object.entries(result.nodes).sort(([a], [b]) => a.localeCompare(b)));
  result.rewards = Object.fromEntries(Object.entries(result.rewards).sort(([a], [b]) => a.localeCompare(b)));
  return result;
}
