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
