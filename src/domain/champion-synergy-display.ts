import { buildSynergyCardContent, type ChampionSynergyCard, type SynergyPartner } from "./champion-synergies"

export type SynergyAvailability = { championRarities: number[]; partners: SynergyPartner[]; ids: string[] }
export type ChampionSynergyDisplayCard = ChampionSynergyCard & { ids: string[]; availability: SynergyAvailability[] }
export type ChampionSynergyFamily = { id: string; name: string; variants: Array<ChampionSynergyDisplayCard & { level: number | null }> }

const sorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b)

/** Shorten consecutive stars without implying availability in gaps. */
export function formatSynergyRarities(rarities: number[]): string {
  const values = sorted(rarities)
  const ranges: string[] = []
  for (let index = 0; index < values.length; index++) {
    const start = values[index]
    while (values[index + 1] === values[index] + 1) index++
    const end = values[index]
    ranges.push(start === end ? `${start}★` : `${start}–${end}★`)
  }
  return ranges.join(", ") || "Not recorded"
}

const partnerKey = (partners: SynergyPartner[]) => partners.map(partner => ({ id: partner.id, rarities: sorted(partner.rarities) })).sort((a, b) => a.id - b.id)
const hasKnownAvailability = (card: ChampionSynergyCard) => !!card.rarities?.length && card.partners.length > 0 && card.partners.every(partner => partner.rarities.length > 0)
const memberKey = (card: ChampionSynergyCard) => [card.partners.map(partner => partner.id).sort((a, b) => a - b), card.champions?.map(champion => champion.id).sort((a, b) => a - b)]

/** Group complete equivalent catalog cards without changing their source identities or activation pairs. */
export function groupChampionSynergyCards(cards: ChampionSynergyCard[]): ChampionSynergyDisplayCard[] {
  const result: ChampionSynergyDisplayCard[] = []
  const equivalent = new Map<string, ChampionSynergyDisplayCard>()
  for (const card of cards) {
    const identity = hasKnownAvailability(card) ? JSON.stringify([
      card.name, buildSynergyCardContent(card.description, card.unique), card.unique,
      ...memberKey(card),
    ]) : null
    let display = identity ? equivalent.get(identity) : undefined
    if (!display) {
      display = { ...card, ids: [], availability: [] }
      result.push(display)
      if (identity) equivalent.set(identity, display)
    }
    if (!display.ids.includes(card.id)) display.ids.push(card.id)
    const championRarities = sorted(card.rarities ?? [])
    const availability = display.availability.find(rule => JSON.stringify(rule.championRarities) === JSON.stringify(championRarities)
      && (card.partners.length === 1 || JSON.stringify(partnerKey(rule.partners)) === JSON.stringify(partnerKey(card.partners))))
    if (availability) {
      if (!availability.ids.includes(card.id)) availability.ids.push(card.id)
      // Only one partner axis varies here; current-champion stars are identical.
      if (card.partners.length === 1) availability.partners[0].rarities = sorted([...availability.partners[0].rarities, ...card.partners[0].rarities])
    } else display.availability.push({ championRarities, ids: [card.id], partners: card.partners.map(partner => ({ ...partner, rarities: sorted(partner.rarities) })) })
  }
  return result
}

/** Keep each exact bonus/availability row, sharing only the leveled family and partner header. */
export function groupChampionSynergyFamilies(cards: ChampionSynergyCard[]): ChampionSynergyFamily[] {
  const families: ChampionSynergyFamily[] = []
  const byIdentity = new Map<string, ChampionSynergyFamily>()
  for (const card of groupChampionSynergyCards(cards)) {
    const match = card.name.match(/^(.+?)\s+(?:-\s*)?Lv\.?\s*(\d+)$/i)
    const name = match?.[1] ?? card.name
    const identity = match && hasKnownAvailability(card) ? JSON.stringify([name, card.unique, ...memberKey(card)]) : null
    let family = identity ? byIdentity.get(identity) : undefined
    if (!family) {
      family = { id: card.id, name, variants: [] }
      families.push(family)
      if (identity) byIdentity.set(identity, family)
    }
    family.variants.push({ ...card, level: match ? Number(match[2]) : null })
  }
  for (const family of families) {
    family.variants.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.id.localeCompare(b.id))
    family.id = family.variants[0].id
    if (family.variants.length === 1) family.name = family.variants[0].name
  }
  return families
}
