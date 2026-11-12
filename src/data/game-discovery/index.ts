import snapshot from "./index.json";
import nodeIndex from "../game-node-modifiers/v2/index.json";
import { rewardIdentity, type PackedGameDiscovery, type RewardDiscovery } from "../../domain/game-discovery";

const data = snapshot as unknown as PackedGameDiscovery;
export const getNodeLocations = (id: string) => data.nodeCatalogHash === nodeIndex.catalogHash
  && Object.hasOwn(data.nodes, id) ? data.nodes[id].map(index => data.locations[index]) : [];
export function getRewardDiscovery(type: string, token: string): RewardDiscovery | undefined {
  const reward = data.rewards[rewardIdentity(type, token)];
  return reward && { ...reward, sources: reward.sources.map(([location, scope, quantity, min, max], index) => ({
    ...data.locations[location], key: `${rewardIdentity(type, token)}:${index}`, scope: data.scopes[scope], quantity,
    ...(min !== null ? { minQuantity: min } : {}), ...(max !== null ? { maxQuantity: max } : {}),
  })) };
}
export const listDiscoverableRewards = () => Object.values(data.rewards).map(({ type, token, sample, sources }) => ({ type, token, sample, locations: sources.length }));
