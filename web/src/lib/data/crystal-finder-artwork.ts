import type { ChampionClass } from "@prisma/client"
import { getCrystalPresentation } from "@cerebro/core/data/game-crystals"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"
import { getChampionAcquisition } from "@cerebro/core/data/champion-acquisition"
import { getChampionImageUrl, isChampionImages } from "../championHelper"
import type { CrystalFinderArtwork, FinderPortrait } from "../crystal-finder-artwork"

// Stable editorial curation; these portraits make no pool or availability claim.
const portraitIds = ["ironman", "storm", "gwenom", "hulk", "guillotine_nameless"]
const classTokenIds: Partial<Record<ChampionClass, string>> = {
  SCIENCE: "chemical", SKILL: "trained", MUTANT: "mutant", COSMIC: "cosmic", TECH: "tech", MYSTIC: "mystic",
}
type ChampionArtworkRecord = { images: unknown; class: ChampionClass }

export function projectCrystalFinderArtwork(records: ReadonlyMap<string, ChampionArtworkRecord>, selectedId?: string, rarity?: string): CrystalFinderArtwork {
  const portrait = (gameId: string): FinderPortrait => {
    const record = records.get(gameId)
    const images = record?.images
    // Resolve supported variants only. A secondary/hero-only record is still useful;
    // never send the transparent avatar placeholder as a header portrait.
    const primary = isChampionImages(images) ? getChampionImageUrl(images, "full") : null
    const url = primary?.startsWith("data:") ? getChampionImageUrl(images, "full", "hero") : primary
    return { gameId, championClass: record?.class ?? null, url: url && !url.startsWith("data:") ? url : null }
  }
  const crystal = getCrystalPresentation("7_star_hero_shard_crystal")?.artworkUrl ?? undefined
  const token = (championClass: ChampionClass | null) => {
    const suffix = championClass ? classTokenIds[championClass] : null
    return suffix ? getRewardArtwork("inv", `ascension_token_class_${suffix}`)?.url : undefined
  }
  const piece = (gameId: string, stars = "7") => getChampionAcquisition(gameId).methods
    .filter(method => method.kind === "pieces" && method.rarities.includes(Number(stars)))
    .flatMap(method => method.pieces ?? []).find(item => item.artworkUrl)?.artworkUrl ?? undefined
  const selected = selectedId ? portrait(selectedId) : null
  return {
    portraits: portraitIds.map(portrait).filter(item => item.url),
    motifs: { crystal, token: token("COSMIC"), piece: piece("guillotine_nameless") },
    selected, selectedMotifs: { crystal, token: token(selected?.championClass ?? null), piece: selectedId ? piece(selectedId, rarity || "7") : undefined },
  }
}
