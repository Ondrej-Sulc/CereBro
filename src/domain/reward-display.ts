const types: Record<string, string> = {
  hero: "Champions", hcos: "Champion cosmetics", res: "Resources", inv: "Items", bp: "Champion blueprints", ebp: "Upgrade materials", ebpf: "Material fragments",
  gf: "Crystal shards", gs: "Crystals", relic2: "Relics", sra: "Selectors", evta: "Other rewards", oact: "Other rewards", nothing: "No reward", utitle: "Titles", profilebadge: "Profile badges",
}
export function rewardTypeLabel(type: string) { return types[type] ?? type }

// Exact resource identity; sc is the game's gold/soft-currency resource.
const resourceNames: Readonly<Record<string, string>> = { sc: "Gold" }
export function rewardDisplayName(reward: { type: string; data: string; displayName?: string }) {
  if (reward.type === "sra" && /^[a-f0-9]{24}$/i.test(reward.displayName || reward.data)) return "Reward selector"
  return (reward.type === "res" ? resourceNames[reward.data] : undefined) || reward.displayName || reward.data || rewardTypeLabel(reward.type)
}
