import manifest from "./manifest.json";
import { getRewardArtwork } from "../../game-reward-artwork";

const key = (type: string, data: string, role: string) => JSON.stringify([type, data, role]);
const additional = new Map(manifest.assets.map(asset => [key(asset.type, asset.data, asset.role), Object.freeze(asset)]));

/** Quest and Tower rewards include identities absent from crystal-drop artwork. */
export function getQuestRewardArtwork(type: string, data: string, role: "full" | "fragment" = type === "gf" || type === "ebpf" ? "fragment" : "full") {
  return getRewardArtwork(type, data, role) ?? additional.get(key(type, data, role)) ?? null;
}
