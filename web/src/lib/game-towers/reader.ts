import permanent from "@cerebro/core/data/game-quests/permanent.json";
import { loadTowerBlock, towerBackendIndex } from "@cerebro/core/data/game-quests/tower-backend";
import { loadTowerBlock as loadChallengeBlock, towerChallengeIndex } from "@cerebro/core/data/game-quests/tower-challenges";
import { loadTowerBlock as loadEventBlock, towerEventIndex } from "@cerebro/core/data/game-quests/tower-events";
import type { TowerCatalogEntry, TowerBlockView } from "./types";
import { loadTowerPortraits } from "./champions";
import { projectTowerDefender, projectTowerModifiers, projectTowerRewards } from "./presentation";

export async function getTowerCatalog(): Promise<TowerCatalogEntry[]> {
  const classes: TowerCatalogEntry[] = permanent.towers.map(t => ({
    id: t.id, name: t.name, section: "class", archiveStatus: "unknown",
    classId: t.id.slice("class_".length), artwork: t.artwork ? { url: t.artwork.url, width: t.artwork.width, height: t.artwork.height } : null,
    blockNumbers: Object.values(towerBackendIndex.blocks).filter(b => b.towerId === t.id).map(b => b.blockNumber).sort((a, b) => a - b),
    floorCount: towerBackendIndex.coverage.perTowerFloors[t.id] ?? null,
  }));
  return [...classes, ...towerChallengeIndex.towers.map(t => ({
    id: t.id, name: t.name, section: "challenge" as const, archiveStatus: t.archiveStatus,
    artwork: t.artwork ? { url: t.artwork.url, width: t.artwork.width, height: t.artwork.height } : null, blockNumbers: [...t.blockNumbers],
    floorCount: Object.values(towerChallengeIndex.blocks).filter(b => b.towerId === t.id).reduce((n, b) => n + b.floors, 0),
  })), ...towerEventIndex.towers.map(t => ({
    id: t.id, name: t.name, section: "event" as const, archiveStatus: t.archiveStatus,
    artwork: t.artwork ? { url: t.artwork.url, width: t.artwork.width, height: t.artwork.height } : null, blockNumbers: [...t.blockNumbers], capturedBlockNumbers: [...t.capturedBlockNumbers],
    floorCount: t.source.nativeData.NumFloors, endsAt: t.endsAt, observedAt: t.observedAt,
  }))];
}

export async function getTowerBlockView(towerId: string, blockNumber: number): Promise<TowerBlockView | null> {
  const tower = (await getTowerCatalog()).find(t => t.id === towerId);
  if (!tower || !Number.isSafeInteger(blockNumber) || !tower.blockNumbers.includes(blockNumber)) return null;
  const loader = tower.section === "event" ? loadEventBlock : tower.section === "challenge" ? loadChallengeBlock : loadTowerBlock;
  const block = await loader(towerId, blockNumber);
  if (!block) return null;
  const portraits = await loadTowerPortraits(block);
  const identity = `tower:${towerId}:block:${blockNumber}`;
  const data = block.blockData;
  return { tower, block, floors: block.floors.map(f => ({ ...f, defender: projectTowerDefender(f.defender, portraits),
    modifiers: projectTowerModifiers(f.sourceData.buffs, "Floor modifiers"),
    topModifiers: projectTowerModifiers(f.sourceData.topBuffs, "Floor rules"),
    rewards: projectTowerRewards(f.sourceData.rewards, `${identity}:floor:${f.floorNumber}:rewards`, "Floor rewards", portraits),
  })),
    blockRewards: projectTowerRewards(data.rewards, `${identity}:rewards`, "Block rewards", portraits),
    ratingRewards: projectTowerRewards(data.ratingRewards, `${identity}:ratingRewards`, "Rating rewards", portraits),
    entryCost: projectTowerRewards(data.floorCost, `${identity}:floorCost`, "Entry cost", portraits),
    blockModifiers: projectTowerModifiers(data.buffs, "Block modifiers"),
    topBlockModifiers: projectTowerModifiers(data.topBuffs, "Block rules"),
  };
}
