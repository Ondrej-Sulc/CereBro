import { buildChampionKitOverviewEffects } from "@/lib/champion-kit"
import { buildChampionSynergyView } from "@/lib/champion-synergies"
import { championAbilityTextContent } from "@/lib/champion-ability-search"
import type { ChampionSection } from "@/lib/champion-page-state"
import type { ChampionDetailsView } from "./champion-details-types"

export type AvailableChampionSection = { value: ChampionSection; label: string }

export function getChampionDescriptionPanels(description: ChampionDetailsView["descriptionView"]) {
  return [description.signaturePanel, ...description.descriptionPanels].filter(panel =>
    [panel.introRecord, ...(panel.specialAttackIntros?.map(intro => intro.record) ?? []), ...panel.recordGroups.flatMap(group => group.records)]
      .some(record => record && championAbilityTextContent(record.prepared).trim()))
}

export function getChampionBiography(description: ChampionDetailsView["descriptionView"]) {
  return description.bioRecords.filter(record => championAbilityTextContent(record.prepared).trim())
}

/** Availability follows the whole record, so changing builds never removes navigation. */
export function getChampionSectionAvailability(view: Pick<ChampionDetailsView, "champion" | "glossaryById" | "descriptionView">) {
  const champion = view.champion
  const hasKit = buildChampionKitOverviewEffects(champion.abilities.filter(link => link.type === "ABILITY"), view.glossaryById).length > 0
    || buildChampionKitOverviewEffects(champion.abilities.filter(link => link.type === "IMMUNITY"), view.glossaryById).length > 0
  const hasOverview = hasKit || champion.tags.length > 0 || champion.duels.length > 0 || champion.hasQuestEncounters === true
  const hasAbilityPanels = getChampionDescriptionPanels(view.descriptionView).length > 0
  const hasDescriptions = hasAbilityPanels || getChampionBiography(view.descriptionView).length > 0
  const synergies = buildChampionSynergyView(champion.gameSynergies, champion.id, null)
  const hasSynergies = synergies.owned.length + synergies.incoming.length > 0
  const hasStats = champion.stats.some(row => !!row.rarity && Number.isFinite(row.challengeRating))
  const hasAttacks = champion.attacks.some(attack => attack.hits.length > 0)
  const hasAcquisition = champion.isPlayable !== false && (
    (champion.acquisition?.methods.length ?? 0) > 0
    || (champion.crystalAvailability?.crystals.length ?? 0) > 0
    || Object.values(champion.crystalAvailability?.otherCounts ?? {}).some(count => count > 0))
  const sections: AvailableChampionSection[] = []
  if (hasOverview) sections.push({ value: "overview", label: hasKit ? "Kit overview" : "Overview" })
  if (hasDescriptions) sections.push({ value: "abilities", label: hasAbilityPanels ? "Full abilities" : "Biography" })
  if (hasSynergies) sections.push({ value: "synergies", label: "Synergies" })
  if (hasStats || hasAttacks) sections.push({ value: "stats", label: hasStats && hasAttacks ? "Stats & attacks" : hasStats ? "Stats" : "Attacks" })
  if (hasAcquisition) sections.push({ value: "crystals", label: "How to obtain" })
  const defaultSection: ChampionSection = !hasKit && hasAbilityPanels ? "abilities" : sections[0]?.value ?? "overview"
  return { sections, defaultSection, hasKit, hasStats, hasAttacks }
}
