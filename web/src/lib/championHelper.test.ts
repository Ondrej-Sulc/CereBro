import { describe, expect, it } from "vitest";
import { getChampionImageUrl, getChampionImageUrlOrPlaceholder, isChampionImages } from "./championHelper";

// Summoned Symbiote's live record has all portrait sizes, but no hero key.
const portraits = {
  p_32: "/32/primary.png", p_64: "/64/primary.png", p_128: "/128/primary.png",
  s_32: "/32/secondary.png", s_64: "/64/secondary.png", s_128: "/128/secondary.png",
  full_primary: "/256/primary.png", full_secondary: "/256/secondary.png",
};

describe("champion image selection", () => {
  it("keeps valid portraits visible when hero artwork is absent", () => {
    expect(isChampionImages(portraits)).toBe(true);
    for (const size of ["32", "64", "128", "full"] as const) {
      expect(getChampionImageUrlOrPlaceholder(portraits, size)).toBe(size === "full" ? portraits.full_primary : portraits[`p_${size}`]);
      expect(getChampionImageUrlOrPlaceholder(portraits, size, "secondary")).toBe(size === "full" ? portraits.full_secondary : portraits[`s_${size}`]);
    }
  });

  it("uses the secondary artwork for a missing hero, retaining a real hero when available", () => {
    expect(getChampionImageUrl(portraits, "full", "hero")).toBe(portraits.full_secondary);
    expect(getChampionImageUrl({ ...portraits, hero: "/hero.png" }, "full", "hero")).toBe("/hero.png");
  });

  it("uses an available resolution without allowing unrelated malformed fields to hide it", () => {
    expect(getChampionImageUrl({ p_128: "/portrait.png", hero: null }, "64")).toBe("/portrait.png");
    expect(getChampionImageUrl({ s_64: "/art.png", p_128: 42 }, "full", "hero")).toBe("/art.png");
    expect(getChampionImageUrl({ hero: " ", full_secondary: "/art.png" }, "full", "hero")).toBe("/art.png");
  });

  it("rejects invalid image values and never passes a non-string to the image component", () => {
    for (const value of [null, undefined, [], "image.png", {}, { hero: 123 }, { p_64: " " }]) {
      expect(isChampionImages(value)).toBe(false);
      expect(getChampionImageUrlOrPlaceholder(value, "64")).toMatch(/^data:image\/gif;base64,/);
    }
  });
});
