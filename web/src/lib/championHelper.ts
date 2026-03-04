import { ChampionImages } from '@/types/champion';

export function getChampionImageUrl(
  images: ChampionImages,
  size: "32" | "64" | "128" | "full" = "full",
  type: "primary" | "secondary" | "hero" = "primary"
): string {
  if (type === "hero") {
    return images.hero;
  }

  if (size === "full") {
    return type === "primary"
      ? images.full_primary
      : images.full_secondary;
  }

  const key = `${type.charAt(0)}_${size}` as keyof ChampionImages;
  return images[key];
}

export function getMaxRank(stars: number): number {
  if (stars === 7) return 6;
  if (stars >= 4) return 5;
  if (stars === 3) return 4;
  if (stars === 2) return 3;
  if (stars === 1) return 2;
  return 5;
}

export function normalizeChampionName(name: string): string {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Returns a Tailwind border + shadow class string for a given star level.
 * Centralized here to avoid duplication across ChampionCard, UpdatedChampionItem, and the Quest Timeline.
 */
export function getStarBorderClass(stars: number): string {
  const map: Record<number, string> = {
    7: "border-purple-600 shadow-purple-900/10",
    6: "border-sky-600 shadow-sky-900/10",
    5: "border-red-600 shadow-red-900/10",
    4: "border-yellow-600 shadow-yellow-900/10",
    3: "border-slate-400 shadow-slate-900/10",
    2: "border-amber-800 shadow-amber-900/10",
    1: "border-slate-600 shadow-slate-900/10",
  };
  return map[stars] ?? "border-slate-800 shadow-black/10";
}
