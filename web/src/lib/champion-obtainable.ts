import type { Champion } from "@/types/champion";

const STAR_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

export function isChampionObtainableAs(champion: Pick<Champion, "obtainable">, stars: number) {
  const target = String(stars);
  return champion.obtainable.some((rarity) => {
    const normalized = rarity.trim().toLowerCase();
    return normalized === target || normalized === `${target}*` || normalized === `${target}-star`;
  });
}

export function getObtainableStarLevels(champion: Pick<Champion, "obtainable">) {
  return STAR_LEVELS.filter((stars) => isChampionObtainableAs(champion, stars));
}

export function hasObtainableStarInRange(
  champion: Pick<Champion, "obtainable">,
  minStarLevel?: number | null,
  maxStarLevel?: number | null
) {
  return getObtainableStarLevels(champion).some((stars) => {
    if (minStarLevel && stars < minStarLevel) return false;
    if (maxStarLevel && stars > maxStarLevel) return false;
    return true;
  });
}
