import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"
import { getRewardArtwork, getRewardArtworkStatus, rewardArtworkCoverage, rewardArtworkSource, rewardClassColors } from "./index"

it("binds published game reward images to the unchanged all-opening source", () => {
  const bytes = readFileSync(path.resolve(process.cwd(), "src/data/game-crystal-openings/catalog.json"))
  expect(rewardArtworkSource.openingCatalogSha256).toBe(createHash("sha256").update(bytes).digest("hex"))
  expect(rewardArtworkCoverage.resolved).toBe(1397)
  expect(JSON.stringify(rewardArtworkSource)).not.toMatch(/Users|LocalLow|[A-Z]:\\|CodexArtifacts/)
})

it("provides both Paragon Nexus drops and unique-token Jubilant artwork", () => {
  for (const token of ["sg_5star_nexus_crystal", "sg_6star_nexus_crystal", "jubilant_crystal_dec25"]) {
    const artwork = getRewardArtwork("gs", token)!
    expect(artwork).not.toBeNull()
    expect(artwork.registry).toBe("crystal-token")
    expect(artwork.url).toMatch(/^https:\/\/storage.googleapis.com\/champion-images\/(crystals\/primary|rewards\/full)\/[a-f0-9]{64}\.webp$/)
  }
})

it("keeps full Banquet materials, fragments, inventory tokens and currency distinct", () => {
  const full = getRewardArtwork("ebp", "rare_event")!
  const fragment = getRewardArtwork("ebpf", "rare_event")!
  expect(fragment.role).toBe("fragment")
  expect(fragment.reference).toBe(`${full.reference}_fragment`)
  expect(fragment.url).not.toBe(full.url)
  expect(fragment.tintApplied).toBe(true)
  expect(fragment.tintColor).toBe("23c5ff")
  expect(getRewardArtwork("inv", "ascension_token_class_chemical")?.reference).toContain("gamestore/")
  expect(getRewardArtwork("res", "sc")?.reference).toBe("resources/resource_currency_soft")
  expect(getRewardArtwork("res", "meta_feb2021_shard_crystal")).toBeNull()
  expect(getRewardArtworkStatus("inv", "ascension_token_class_science").status).toBe("missing")
})

it("publishes different colored ISO, catalyst and fragment pixels for all six classes", () => {
  const classes = ["cosmic", "chemical", "mutant", "trained", "mystic", "tech"]
  const materialUrls = classes.map(classId => {
    const full = getRewardArtwork("ebp", `t6_${classId}`)!
    const fragment = getRewardArtwork("ebpf", `t6_${classId}`)!
    const iso = getRewardArtwork("ebp", `blueprint_six_${classId}`)!
    expect(full.tintApplied).toBe(true)
    expect(fragment.tintApplied).toBe(true)
    expect(full.renderTint?.rgba).toEqual(rewardClassColors[`class_${classId}`])
    expect(fragment.renderTint?.rgba).toEqual(full.renderTint?.rgba)
    expect(iso.tintApplied).toBe(true)
    expect(iso.renderTint?.rgba).toEqual(full.renderTint?.rgba)
    expect(iso.reference).toContain("portrait_iso8_rarity6")
    expect(iso.url).not.toBe(full.url)
    expect(fragment.url).not.toBe(full.url)
    return full.url
  })
  expect(new Set(materialUrls).size).toBe(6)
  const bytes = readFileSync(path.resolve(process.cwd(), "src/data/game-reward-artwork/palette.json"))
  expect(rewardArtworkSource.colorDictionary?.paletteSha256).toBe(createHash("sha256").update(bytes).digest("hex"))
})

it("renders exact class awakening gems and both signature stone quantities distinctly from generic controls", () => {
  const classes = ["mutant", "trained", "chemical", "mystic", "cosmic", "tech"]
  // All recorded champion tiers: 2–7-star gems/+1 stones, 3–7-star +5 stones.
  // Tier 7's generic gem is not a recorded opening reward; use the same base
  // texture's recorded tier 6 generic control there.
  const prefixes = [
    ...["awaken", "sigup"].flatMap(kind => ["uncommon", "rare", "epic", "legendary", "t6", "t7"].map(tier => `${kind}_${tier}`)),
    ...["rare", "epic", "legendary", "t6", "t7"].map(tier => `sigupfive_${tier}`),
  ]
  for (const prefix of prefixes) {
    const generic = getRewardArtwork("inv", prefix) ?? getRewardArtwork("inv", `${prefix.split("_")[0]}_t6`)!
    expect(generic.tintApplied).toBe(false)
    const images = classes.map(classId => {
      const image = getRewardArtwork("inv", `${prefix}_${classId}`)!
      expect(image).not.toBeNull()
      expect(image.inputSha256).toBe(generic.inputSha256)
      expect(image.url).not.toBe(generic.url)
      expect(image.tintApplied).toBe(true)
      expect(image.renderTint).toEqual({ source: "color-dictionary", key: `class_${classId}`,
        rgba: rewardClassColors[`class_${classId}`], blendMode: "overlay" })
      return image.url
    })
    expect(new Set(images).size).toBe(6)
  }
  expect(rewardArtworkSource.inventoryShader?.name).toBe("EBG/UI/OverlayColored")
})
