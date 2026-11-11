// Generated offline. Only exact captured Event blocks receive literal imports.
import index from "./manifest.json";
export const towerEventIndex = index;
export const towerBlockLoaders = {
  "event_castellan_5:1": () => import("./blocks/event_castellan_5-001.json"),
  "event_castellan_5:2": () => import("./blocks/event_castellan_5-002.json"),
  "event_castellan_5:3": () => import("./blocks/event_castellan_5-003.json"),
  "event_castellan_5:4": () => import("./blocks/event_castellan_5-004.json"),
  "event_castellan_5:5": () => import("./blocks/event_castellan_5-005.json"),
  "event_castellan_5:6": () => import("./blocks/event_castellan_5-006.json"),
  "event_castellan_5:7": () => import("./blocks/event_castellan_5-007.json"),
  "event_castellan_5:8": () => import("./blocks/event_castellan_5-008.json"),
  "event_castellan_5:9": () => import("./blocks/event_castellan_5-009.json"),
  "event_castellan_5:10": () => import("./blocks/event_castellan_5-010.json"),
  "event_ggsfa1:1": () => import("./blocks/event_ggsfa1-001.json"),
  "event_ggsfa1:2": () => import("./blocks/event_ggsfa1-002.json"),
};
export async function loadTowerBlock(towerId, blockNumber) {
  if (typeof towerId !== "string" || !Number.isInteger(blockNumber) || blockNumber < 1) return undefined;
  const key = `${towerId}:${blockNumber}`;
  if (!Object.hasOwn(towerBlockLoaders, key)) return undefined;
  return (await towerBlockLoaders[key]()).default;
}
