export interface ChampionImages {
  p_32: string;
  p_64: string;
  s_32: string;
  s_64: string;
  p_128: string;
  s_128: string;
  full_primary: string;
  full_secondary: string;
  hero: string;
}

export function getChampionImageUrl(
  images: any,
  size: "32" | "64" | "128" | "full" = "full",
  type: "primary" | "secondary" | "hero" = "primary"
): string {
  const parsedImages = images as ChampionImages;

  if (type === "hero") {
    return parsedImages.hero;
  }

  if (size === "full") {
    return type === "primary"
      ? parsedImages.full_primary
      : parsedImages.full_secondary;
  }

  const key = `${type.charAt(0)}_${size}` as keyof ChampionImages;
  return parsedImages[key];
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
