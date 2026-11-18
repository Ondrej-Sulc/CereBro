import type { ChampionClass } from "@prisma/client";
import type { QuestMap } from "@cerebro/core/domain/game-quests";
import type { QuestGateDefinition } from "@cerebro/core/domain/game-quests/map-features";
import type { QuestGateTagGroups } from "@cerebro/core/domain/game-quests/gate-tag-layout";
import raw from "@cerebro/core/data/game-quests/gate-presentation.json";
import rawRewards from "@cerebro/core/data/game-quests/path-reward-presentation.json";
import { permanentData } from "@cerebro/core/data/game-quests/permanent";
import { nativeRewardName, type NativeRewardPresentation } from "@cerebro/core/data/game-reward-presentation";
import { CLASS_ICONS } from "@/app/profile/roster/constants";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrl } from "@/lib/championHelper";
import { isExactQuestChampionBinding } from "./champion-binding";
import { projectRewardRow, type PublicChampionRow, type QuestPortrait } from "./presentation";
import type { QuestGateChampionFilterGroups } from "./gate-champion-filter";

export type QuestGateVisual = {
  kind: "champion" | "class" | "rarity" | "tags" | "resource" | "switch" | "unknown";
  images: { src: string; label: string }[];
  className?: string;
  color?: string;
  rarity?: number;
  countLabel?: string;
  caption?: string;
  tagGroups?: QuestGateTagGroups;
  filterGroups?: QuestGateChampionFilterGroups;
};

type GateCharacter = { gameId: string; name: string; sourcePointer: string };
const data = raw as { version: number; source: { bcgSha256: string }; blueprints: Record<string, GateCharacter>; tagNames: Record<string, string>; resourceNames: Record<string, string> };
if (data.version !== 1 || data.source.bcgSha256 !== permanentData.bcgSha256) throw new Error("Quest gate identity source mismatch");
const rewards = rawRewards.rewards as Record<string, NativeRewardPresentation & { imageUrl?: string }>;
// These are exact BCG class IDs, not substrings of champion or tag names.
const classes: Record<string, ChampionClass> = { chemical: "SCIENCE", trained: "SKILL", mystic: "MYSTIC", cosmic: "COSMIC", tech: "TECH", mutant: "MUTANT", superior: "SUPERIOR" };
const rarities: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, t6: 6, t7: 7 };
const operators: Record<string, string> = { eq: "=", gt: ">", gte: "≥", lt: "<", lte: "≤" };
const validImage = (src: string | null | undefined): src is string => typeof src === "string" && /^(https?:\/\/|\/(?!\/))/.test(src);
const classLabel = (value: ChampionClass) => value.charAt(0) + value.slice(1).toLowerCase();

function gateChampions(gate: QuestGateDefinition): GateCharacter[] | undefined {
  const constraints = gate.constraints;
  if (gate.kind !== "champion" || constraints?.nativeType !== "hasChampion" || constraints.championLogic !== "any" || !constraints.champions.length) return undefined;
  const allowed = constraints.champions.map(blueprint => data.blueprints[blueprint]);
  if (allowed.some(identity => !identity)) return undefined;
  return [...new Map(allowed.map(identity => [identity.gameId, identity])).values()];
}

/** Gate character IDs come only from a finite, frozen exact Blueprint → Character table. */
export function questGateChampionGameIds(map: Pick<QuestMap, "features">): string[] {
  return [...new Set((map.features?.gates ?? []).flatMap(gate => gateChampions(gate)?.map(identity => identity.gameId) ?? []))].sort();
}

/** Project exact gate bindings separately: gates never become encounters or rewards. */
export function projectQuestGatePortraits(map: QuestMap, rows: PublicChampionRow[]): Record<string, QuestPortrait> {
  const allowed = new Set(questGateChampionGameIds(map));
  const claims = [...map.encounters, ...map.rewards.fixedChampions].filter(identity => identity.champion);
  const candidates = rows.filter(row => row.gameId && allowed.has(row.gameId) && Number.isSafeInteger(row.id) && row.id > 0
    && claims.every(identity => (identity.champion!.id !== row.id || identity.gameId === row.gameId)
      && (identity.gameId !== row.gameId || identity.champion!.id === row.id)));
  const idCounts = new Map<number, number>(), gameIdCounts = new Map<string | null, number>();
  for (const row of candidates) {
    idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
    gameIdCounts.set(row.gameId, (gameIdCounts.get(row.gameId) ?? 0) + 1);
  }
  return Object.fromEntries(candidates.filter(row => idCounts.get(row.id) === 1 && gameIdCounts.get(row.gameId) === 1).map(row => {
    const src = getChampionImageUrl(row.images, "128");
    return [row.gameId!, { name: row.name, href: row.slug ? `/champions/${encodeURIComponent(row.slug)}` : null, imageUrl: validImage(src) ? src : null,
      className: classLabel(row.class), color: getChampionClassColors(row.class).color, championBinding: { id: row.id, gameId: row.gameId! } }];
  }));
}

export function projectQuestGateVisual(gate: QuestGateDefinition, portraits: Record<string, QuestPortrait> = {}): QuestGateVisual {
  const constraints = gate.constraints;
  const unknown: QuestGateVisual = { kind: "unknown", images: [], caption: "Gate requirements unavailable" };
  if (!constraints) return unknown;
  const countLabel = operators[constraints.countOperator] === undefined ? undefined : `${operators[constraints.countOperator]}${constraints.count}`;
  if (gate.kind === "champion") {
    const champions = gateChampions(gate);
    if (!champions) return unknown;
    const images = champions.flatMap(identity => {
      const portrait = portraits[identity.gameId];
      return isExactQuestChampionBinding({ gameId: identity.gameId, champion: null }, portrait) && validImage(portrait?.imageUrl)
        ? [{ src: portrait.imageUrl, label: portrait.name }] : [];
    });
    const portrait = champions.length === 1 ? portraits[champions[0].gameId] : undefined;
    const exact = portrait && isExactQuestChampionBinding({ gameId: champions[0].gameId, champion: null }, portrait);
    return { kind: "champion", images, caption: champions.map(identity => identity.name).join(" or "), ...(countLabel ? { countLabel } : {}),
      ...(exact ? { className: portrait.className, color: portrait.color } : {}) };
  }
  if (gate.kind === "class" || gate.kind === "class-and-rarity" || gate.kind === "rarity") {
    const championClass = constraints.class ? classes[constraints.class] : undefined;
    const rarity = constraints.rarity ? rarities[constraints.rarity] : undefined;
    if ((gate.kind !== "rarity" && !championClass) || (gate.kind !== "class" && !rarity)) return unknown;
    const label = championClass ? classLabel(championClass) : undefined;
    return { kind: championClass ? "class" : "rarity", images: championClass ? [{ src: CLASS_ICONS[championClass], label: label! }] : [],
      ...(label ? { className: label, color: getChampionClassColors(championClass).color } : {}), ...(rarity ? { rarity } : {}),
      ...(countLabel ? { countLabel } : {}), caption: [rarity ? `${rarity}★` : undefined, label, "champions"].filter(Boolean).join(" ") };
  }
  if (gate.kind === "tags") {
    if (constraints.tagLogic !== "any-group-all-terms" || !constraints.tags?.length) return unknown;
    const groups = constraints.tags.map(group => group.trim().toLowerCase().split(":"));
    if (groups.some(terms => terms.some(term => !data.tagNames[term.startsWith("!") ? term.slice(1) : term]))) return unknown;
    const tagGroups = groups.map(terms => terms.map(term => ({ label: data.tagNames[term.startsWith("!") ? term.slice(1) : term], negated: term.startsWith("!") })));
    const filterGroups: QuestGateChampionFilterGroups = groups.map(terms => terms.map(term => {
      const token = term.startsWith("!") ? term.slice(1) : term;
      return classes[token] ? { kind: "class", value: classes[token], negated: term.startsWith("!") } : { kind: "tag", value: data.tagNames[token], negated: term.startsWith("!") };
    }));
    const captions = tagGroups.map(terms => terms.map(term => `${term.negated ? "not " : ""}#${term.label}`).join(" and "));
    const caption = captions.map((caption, i) => groups.length > 1 && groups[i].length > 1 ? `(${caption})` : caption).join(" or ");
    // Only a complete group that is one exact positive class term gets a class glyph.
    const simpleClasses = groups.every(terms => terms.length === 1 && classes[terms[0]]) ? [...new Set(groups.map(terms => classes[terms[0]]))] : [];
    return { kind: "tags", images: simpleClasses.map(championClass => ({ src: CLASS_ICONS[championClass], label: classLabel(championClass) })),
      ...(countLabel ? { countLabel } : {}), ...(!simpleClasses.length ? { tagGroups } : {}), filterGroups, caption };
  }
  if (gate.kind === "resource") {
    if (!constraints.costs?.length) return unknown;
    const costs = constraints.costs.map(cost => {
      const view = projectRewardRow(cost, "gateCosts", `${gate.barrierId}:${cost.sourceIndex}`, portraits);
      const key = JSON.stringify([cost.type, cost.data]), supplement = rewards[key];
      return { name: supplement ? nativeRewardName(supplement, cost.type) : data.resourceNames[key] ?? view.name,
        src: supplement?.imageUrl ?? view.imageUrl, quantity: view.amount ?? `×${cost.quantity.toLocaleString("en")}` };
    });
    return { kind: "resource", images: costs.flatMap(cost => validImage(cost.src) ? [{ src: cost.src, label: cost.name }] : []),
      ...(costs.length === 1 ? { countLabel: costs[0].quantity } : {}), caption: costs.map(cost => `${costs.length > 1 ? `${cost.quantity} ` : ""}${cost.name}`).join(" and ") };
  }
  if (gate.kind === "switch") return { kind: "switch", images: [], caption: "Activate switch" };
  return unknown;
}
