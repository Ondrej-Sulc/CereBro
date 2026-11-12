import raw from "@cerebro/core/data/game-quests/tower-presentation/catalog.json";
import modifierSources from "@cerebro/core/data/game-quests/tower-presentation/sources.json";
import { nativeModifierHref } from "@cerebro/core/data/game-node-modifiers/links";
import { getQuestRewardArtwork as getRewardArtwork } from "@cerebro/core/data/game-quests/reward-artwork";
import { getSelectableReward } from "@cerebro/core/data/game-selectable-rewards";
import { rewardDisplayName } from "@cerebro/core/domain/reward-display";
import { getNativeRewardPresentation, nativeRewardName } from "@cerebro/core/data/game-reward-presentation";
import { getPublicRewardDefinition } from "@cerebro/core/data/game-reward-definitions";
import { getStaticResourceRewardArtwork } from "@cerebro/core/data/game-resource-artwork";
import { getPublicResourceDefinition } from "@cerebro/core/data/game-resource-definitions";
import { resolveNativeGameModifierIcon } from "@cerebro/core/domain/node-modifiers/native-game-icons";
import { resolveQuestCrystal, type QuestPortrait, type QuestRewardView } from "@/lib/game-quests/presentation";
import type { TowerModifierView, TowerFloorView } from "./types";
import type { CapturedTowerDefender } from "@cerebro/core/domain/game-quests/tower-data";

type NativeRow = Readonly<Record<string, unknown>>;
interface PresentationCatalog {
  bcgSha256: string;
  modifiers: Record<string, { name: string | null; descriptions: Record<string, string>; rawDescription: string | null; iconKey: string | null }>;
  champions: Record<string, { name: string | null; imageId: string | null; s3ImageId: string | null }>;
  rewards: Record<string, { displayName?: string; gameId?: string; rarity?: number }>;
}
export const towerPresentation = raw as unknown as PresentationCatalog;
const modifierProofs = modifierSources as unknown as { bcgSha256: string; modifierProofs: Record<string, { versionHash?: string }> };
export const nativeRows = (value: unknown): NativeRow[] => Array.isArray(value)
  ? value.filter((v): v is NativeRow => v !== null && typeof v === "object" && !Array.isArray(v)) : [];
const string = (v: unknown) => typeof v === "string" ? v : null;
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;

export function projectTowerDefender(defender: CapturedTowerDefender | null, portraits: Record<string, QuestPortrait>): TowerFloorView["defender"] {
  if (!defender) return null;
  const portrait = defender.gameId ? portraits[defender.gameId] : undefined;
  const nativeName = defender.gameId ? towerPresentation.champions[defender.gameId]?.name : null;
  const classes: Record<string, string> = { skill: "Skill", trained: "Skill", mutant: "Mutant", tech: "Tech",
    cosmic: "Cosmic", mystic: "Mystic", science: "Science", chemical: "Science", universal: "Universal", combined: "Combined" };
  return { ...defender, fullHealth: defender.maxHealth,
    name: portrait?.name ?? nativeName ?? "Recorded defender", imageUrl: portrait?.imageUrl ?? null, href: portrait?.href ?? null,
    className: portrait?.className ?? (defender.classId ? classes[defender.classId] ?? "NPC / legacy defender" : "Unknown class") };
}

export function cleanTowerText(value: string): string {
  return value.replace(/\\r\\n|\\n|\r\n/g, "\n")
    .replace(/\[k=[^\]]+\]|\[\/k\]|\[(?:[a-f\d]{6,8}|-)\]/gi, "").trim();
}

export function projectTowerModifiers(value: unknown, sourceScope: string): TowerModifierView[] {
  return nativeRows(value).map(r => {
    const id = string(r.n) ?? "";
    const quantity = number(r.q);
    const definition = r.t === "buff" ? towerPresentation.modifiers[id] : undefined;
    const description = quantity === null ? null : definition?.descriptions[String(quantity)] ?? null;
    return { id, name: definition?.name ?? "Recorded modifier", description,
      quantity, iconKey: definition?.iconKey && resolveNativeGameModifierIcon(definition.iconKey) ? definition.iconKey : null,
      definitionHref: definition && modifierProofs.bcgSha256 === towerPresentation.bcgSha256 ? nativeModifierHref(id, modifierProofs.modifierProofs[id]?.versionHash, towerPresentation.bcgSha256) : null,
      sourceScope, condition: null, persistence: null, sourceData: r };
  });
}

const labels: Record<string, string> = {
  res: "Resource", ebp: "Upgrade material", ebpf: "Material fragments", gf: "Crystal shards", inv: "Item",
  sra: "Reward selector", utitle: "Title", profilebadge: "Profile badge", emote: "Emote", gsi: "Rating reward",
};

/** A Tower scope and identity are supplied directly, without synthetic quest records. */
export function projectTowerRewards(value: unknown, identity: string, scope: string, portraits: Record<string, QuestPortrait> = {}): QuestRewardView[] {
  return nativeRows(value).map((r, index) => {
    const type = string(r.t) ?? "unknown", token = string(r.n) ?? "";
    const definition = towerPresentation.rewards[`${type}:${token}`];
    const quantity = number(r.q);
    const portrait = definition?.gameId ? portraits[definition.gameId] : undefined;
    const crystal = type === "gs" ? resolveQuestCrystal(token) : null;
    const shards = type === "gf" ? resolveQuestCrystal(token) : null;
    const selector = type === "sra" ? getSelectableReward(token) : undefined;
    const native = getNativeRewardPresentation(type, token);
    const publicDefinition = getPublicRewardDefinition(type, token);
    const publicResource = getPublicResourceDefinition(type, token);
    const placeholder = type === "inv" && token === "unknown_rewards";
    const fallback = labels[type] ?? "Recorded reward";
    const name = placeholder ? "Reward details not specified" : portrait?.name
      ?? (definition?.gameId ? towerPresentation.champions[definition.gameId]?.name : null)
      ?? selector?.name ?? (publicDefinition?.name || null) ?? publicResource?.name ?? (native ? nativeRewardName(native, type) : null) ?? definition?.displayName ?? (type === "res" && token === "sc" ? rewardDisplayName({ type, data: token }) : null)
      ?? crystal?.name ?? (type === "hero" ? "Recorded champion" : fallback);
    return { key: `${identity}:${index}`, scope, token, sourceType: type, quantity: quantity ?? 0,
      amount: quantity === null ? "Quantity unavailable" : `×${quantity.toLocaleString("en")}`,
      type: type === "hero" ? "champion" : crystal ? "crystal" : "item", name,
      imageUrl: portrait?.imageUrl ?? getRewardArtwork(type, token)?.url ?? getStaticResourceRewardArtwork(type, token)?.url ?? publicResource?.imageUrl ?? publicDefinition?.imageUrl ?? crystal?.imageUrl ?? null,
      href: portrait?.href ?? crystal?.href ?? shards?.href ?? null,
      rarity: definition?.rarity, itemRarity: native?.rarity, signaturePoints: native?.signaturePoints, rankChange: native?.rankChange, placeholder,
      recordedOutcome: !["hero", "gs", "gf", "res", "ebp", "ebpf", "inv", "sra", "utitle", "profilebadge", "emote", "gsi"].includes(type),
    };
  });
}
