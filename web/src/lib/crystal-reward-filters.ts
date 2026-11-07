export const CRYSTAL_REWARD_FILTERS = [
  { id: "all", name: "All rewards" },
  { id: "champions", name: "Champion pools" },
  { id: "items", name: "Materials & more" },
  { id: "mixed", name: "Mixed rewards" },
  { id: "ascension", name: "7★ Ascension" },
] as const

// Ascension overlaps the three reward kinds; it does not change their partition.
export type CrystalRewardKind = "champions" | "items" | "mixed"

export function crystalRewardFilterUsesChampionStars(reward: string) {
  return reward !== "items" && reward !== "ascension"
}
