import type { CapturedTowerBlock, CapturedTowerDefender } from "@cerebro/core/domain/game-quests/tower-data";
import type { QuestRewardView } from "@/lib/game-quests/presentation";

export interface TowerCatalogEntry {
  id: string;
  name: string;
  section: "class" | "challenge" | "event";
  blockNumbers: number[];
  floorCount: number | null;
  artwork: { url: string; width: number; height: number } | null;
  classId?: string;
  archiveStatus: "active" | "archived" | "unknown";
  endsAt?: string | null;
  observedAt?: string;
  capturedBlockNumbers?: number[];
}

export interface TowerModifierView {
  id: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  quantity: number | null;
  sourceScope?: string;
  /** Native conditions/persistence stay separate from the modifier description. */
  condition?: string | null;
  persistence?: string | null;
  sourceData?: Readonly<Record<string, unknown>>;
}

export interface TowerFloorView {
  floorNumber: number;
  defender: (CapturedTowerDefender & {
    name: string;
    imageUrl: string | null;
    href: string | null;
    className: string;
    /** Full recorded enemy HP; health retains separate backend current HP. */
    fullHealth: number | null;
  }) | null;
  modifiers: TowerModifierView[];
  topModifiers: TowerModifierView[];
  rewards: QuestRewardView[];
  sourceData: Readonly<Record<string, unknown>>;
}

export interface TowerBlockView {
  tower: TowerCatalogEntry;
  block: CapturedTowerBlock;
  floors: TowerFloorView[];
  blockRewards: QuestRewardView[];
  ratingRewards: QuestRewardView[];
  entryCost: QuestRewardView[];
  blockModifiers: TowerModifierView[];
  topBlockModifiers: TowerModifierView[];
}
