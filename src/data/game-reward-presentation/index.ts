import raw from "./catalog.json";

export type RewardRankChange = Readonly<{ from: number; to: number }>;
export type NativeRewardPresentation = Readonly<{
  name: string;
  rarity?: number;
  className?: string;
  rankChange?: RewardRankChange;
  signaturePoints?: number;
}>;

const records = raw.rewards as Readonly<Record<string, NativeRewardPresentation>>;
export const nativeRewardPresentationSource = raw.source;

/** Presentation metadata joins the exact reward type and native registry ID. */
export function getNativeRewardPresentation(type: string, data: string): NativeRewardPresentation | null {
  return records[JSON.stringify([type, data])] ?? null;
}

export function nativeRewardName(value: NativeRewardPresentation, type?: string): string {
  const rarity = value.rarity && !/\b\d[- ]star\b/i.test(value.name) ? `${value.rarity}-Star ` : "";
  const className = value.className && !value.name.toLowerCase().includes(value.className.toLowerCase()) ? `${value.className} ` : "";
  const rank = value.rankChange ? ` · Rank ${value.rankChange.from} → ${value.rankChange.to}` : "";
  const signature = value.signaturePoints ? ` · +${value.signaturePoints}` : "";
  const fragments = type === "ebpf" && !/\bfragments?\b/i.test(value.name) ? " Fragments" : "";
  return `${rarity}${className}${value.name}${fragments}${rank}${signature}`;
}
