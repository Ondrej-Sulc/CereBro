import { MCOC_PRESTIGE_RARITY_CURVES } from "./mcoc-prestige-rarity-curves";

export type McocPrestigeEndpoint = {
  rarity: number;
  rank: number;
  sig: number;
  prestige: number;
};

export type McocPrestigeStat = {
  rarity: number | null | undefined;
  rank: number;
  prestige: number | null | undefined;
};

export function maxSigForRarity(rarity: number | null | undefined) {
  return rarity && rarity < 5 ? 99 : 200;
}

export function calculateMcocPrestige(
  prestigeData: McocPrestigeEndpoint[],
  stat: McocPrestigeStat | undefined,
  sigLevel: number
) {
  if (!stat?.rarity) return stat?.prestige ?? null;

  const maxSig = maxSigForRarity(stat.rarity);
  const clampedSig = Math.max(0, Math.min(maxSig, Math.round(sigLevel)));
  const rows = prestigeData.filter(row => row.rarity === stat.rarity && row.rank === stat.rank);
  const prestige0 = rows.find(row => row.sig === 0)?.prestige ?? stat.prestige ?? null;
  const prestige1 = rows.find(row => row.sig === 1)?.prestige ?? null;
  const prestigeMax = rows.find(row => row.sig === maxSig)?.prestige ?? null;

  if (prestige0 == null) return null;
  if (clampedSig === 0) return prestige0;
  if (prestige1 == null) return prestige0;
  if (clampedSig === 1) return prestige1;
  if (prestigeMax == null || prestigeMax <= prestige1) return prestige1;
  if (clampedSig >= maxSig) return prestigeMax;

  const curve = MCOC_PRESTIGE_RARITY_CURVES[stat.rarity as keyof typeof MCOC_PRESTIGE_RARITY_CURVES];
  const factor = curve?.[clampedSig - 1];
  if (factor == null) return prestige1;

  return Math.round(prestige1 + (prestigeMax - prestige1) * factor);
}
