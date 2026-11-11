// Generated offline. Exact public sources only.
import index from "./manifest.json";
export const towerChallengeIndex = index;
export const towerBlockLoaders = {
  "challenge_saga:1": () => import("./blocks/challenge_saga-001.json"),
  "challenge_saga:2": () => import("./blocks/challenge_saga-002.json"),
  "challenge_saga:3": () => import("./blocks/challenge_saga-003.json"),
  "challenge_saga:4": () => import("./blocks/challenge_saga-004.json"),
  "challenge_saga:5": () => import("./blocks/challenge_saga-005.json"),
  "challenge_saga:6": () => import("./blocks/challenge_saga-006.json"),
};
export async function loadTowerBlock(towerId, blockNumber) {
  if (!Number.isInteger(blockNumber) || blockNumber < 1) return undefined;
  const key = `${towerId}:${blockNumber}`;
  if (!Object.hasOwn(towerBlockLoaders, key)) return undefined;
  return (await towerBlockLoaders[key]()).default;
}
