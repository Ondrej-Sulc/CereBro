const PRIMARY_IMAGE_KEYS = ["full_primary", "p_128", "p_64", "p_32"] as const;
const SECONDARY_IMAGE_KEYS = ["full_secondary", "s_128", "s_64", "s_32"] as const;
const IMAGE_KEYS = ["hero", ...PRIMARY_IMAGE_KEYS, ...SECONDARY_IMAGE_KEYS];
const isImageUrl = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Missing artwork variants must not hide other usable images in the record. */
export function isChampionImages(obj: unknown): obj is Record<string, unknown> {
  return !!obj && typeof obj === "object" && !Array.isArray(obj)
    && IMAGE_KEYS.some(key => key in obj && isImageUrl((obj as Record<string, unknown>)[key]));
}

// 1x1 transparent GIF base64
const FALLBACK_IMAGE_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function getChampionImageUrl(
  images: unknown,
  size: "32" | "64" | "128" | "full" = "full",
  type: "primary" | "secondary" | "hero" = "primary"
): string {
  if (!isChampionImages(images)) {
    return FALLBACK_IMAGE_URL;
  }

  const variants = type === "primary" ? PRIMARY_IMAGE_KEYS : SECONDARY_IMAGE_KEYS;
  const requested = size === "full" ? variants[0] : `${type.charAt(0)}_${size}`;
  const keys = type === "hero"
    ? ["hero", ...SECONDARY_IMAGE_KEYS, ...PRIMARY_IMAGE_KEYS]
    : [requested, ...variants];
  return keys.map(key => images[key]).find(isImageUrl)?.trim() || FALLBACK_IMAGE_URL;
}

export function getChampionImageUrlOrPlaceholder(
  images: unknown,
  size: "32" | "64" | "128" | "full" = "full",
  type: "primary" | "secondary" | "hero" = "primary"
): string {
  const url = getChampionImageUrl(images, size, type);
  return url || FALLBACK_IMAGE_URL;
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

export function generateChampionSlug(name: string): string {
  if (!name) return "champion";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "champion";
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
