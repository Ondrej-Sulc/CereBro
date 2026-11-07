import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { crystalCatalogSource, getCrystalDetails, getCrystalPresentation } from "@cerebro/core/data/game-crystals"
import { crystalHistoryObservations, getCrystalHistory } from "@cerebro/core/data/game-crystal-history"
import { getCrystalOdds } from "@cerebro/core/data/game-crystal-odds"
import { getCrystalAvailability } from "@cerebro/core/data/game-crystals/availability"

export function loadCrystalOpening(id: string) {
  const opening = getCrystalOpening(id)
  if (!opening) return null
  const membership = getCrystalDetails(id)
  const artwork = getCrystalPresentation(id)
  const history = crystalHistoryObservations.at(-1)?.gachaSha256 === opening.source.gachaSha256 ? getCrystalHistory([id]) : null
  return { ...opening, availability: getCrystalAvailability(id), odds: getCrystalOdds(id, opening.source.gachaSha256), history, artworkUrl: artwork?.artworkUrl ?? null, bannerArtworkUrl: artwork?.bannerArtworkUrl ?? null,
    championPool: membership ? { id: membership.id, name: membership.name, observedAt: crystalCatalogSource.observedAt } : null }
}
