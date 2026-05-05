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

export type McocPrestigePoint = {
  sig: number;
  prestige: number;
};

export function maxSigForRarity(rarity: number | null | undefined) {
  return rarity && rarity < 5 ? 99 : 200;
}

export function maxAscensionLevelForRarity(rarity: number | null | undefined) {
  return rarity === 7 ? 5 : 0;
}

export function clampSigForRarity(sigLevel: number, rarity: number | null | undefined) {
  const maxSig = maxSigForRarity(rarity);
  return Math.max(0, Math.min(maxSig, Math.round(sigLevel)));
}

export function clampAscensionLevelForRarity(ascensionLevel: number, rarity: number | null | undefined) {
  const maxAscension = maxAscensionLevelForRarity(rarity);
  return Math.max(0, Math.min(maxAscension, Math.round(ascensionLevel)));
}

export function roundPrestigeToGameDisplay(value: number) {
  return value > 0 ? Math.round(value / 10) * 10 : 0;
}

export function ascensionMultiplierForRarity(rarity: number | null | undefined, ascensionLevel: number) {
  const clampedAscension = clampAscensionLevelForRarity(ascensionLevel, rarity);
  return rarity === 7 && clampedAscension > 0 ? Math.pow(1.08, clampedAscension) : 1;
}

export function applyAscensionToPrestige(
  value: number | null | undefined,
  rarity: number | null | undefined,
  ascensionLevel: number
) {
  if (value == null) return null;
  return roundPrestigeToGameDisplay(value * ascensionMultiplierForRarity(rarity, ascensionLevel));
}

export function applyAscensionToStatValue(
  value: number | null | undefined,
  rarity: number | null | undefined,
  ascensionLevel: number
) {
  if (value == null) return null;
  return Math.round(value * ascensionMultiplierForRarity(rarity, ascensionLevel));
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

export function projectMcocPrestige({
  prestigeData,
  stat,
  sigLevel,
  ascensionLevel = 0,
}: {
  prestigeData: McocPrestigeEndpoint[];
  stat: McocPrestigeStat | undefined;
  sigLevel: number;
  ascensionLevel?: number;
}) {
  const basePrestige = calculateMcocPrestige(prestigeData, stat, sigLevel);
  return applyAscensionToPrestige(basePrestige, stat?.rarity, ascensionLevel);
}

export function expandMcocPrestigeCurve({
  prestigeData,
  stat,
  ascensionLevel = 0,
}: {
  prestigeData: McocPrestigeEndpoint[];
  stat: McocPrestigeStat;
  ascensionLevel?: number;
}): McocPrestigePoint[] {
  const maxSig = maxSigForRarity(stat.rarity);
  const points: McocPrestigePoint[] = [];

  for (let sig = 0; sig <= maxSig; sig++) {
    const prestige = projectMcocPrestige({ prestigeData, stat, sigLevel: sig, ascensionLevel });
    if (prestige != null) points.push({ sig, prestige });
  }

  return points;
}

export function projectMcocPrestigeFromCurve({
  curve,
  sigLevel,
  rarity,
  ascensionLevel = 0,
}: {
  curve: McocPrestigePoint[];
  sigLevel: number;
  rarity: number | null | undefined;
  ascensionLevel?: number;
}) {
  const sig = clampSigForRarity(sigLevel, rarity);
  const point = curve.find(p => p.sig === sig);
  const basePrestige = point?.prestige ?? null;
  return applyAscensionToPrestige(basePrestige, rarity, ascensionLevel);
}
