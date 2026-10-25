import type { ChampionKitPartnerSources, ChampionKitSynergyLink } from "./champion-kit"

/** Match a source label or a known spelling of that label, never another effect mentioned in the prose. */
export function findInlineSourceReference(condition: string, label: string) {
  const escaped = label.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  if (!escaped) return null
  const special = label.match(/^Special ([123])$/i)
  const pattern = special ? `(?:SP[\\s-]*${special[1]}|Special(?:\\s+Attack)?[\\s-]*${special[1]})`
    : /^Charging Heavy$/i.test(label) ? "charg(?:ing|e)\\s+(?:(?:a|the)\\s+)?Heavy"
      : /^Signature ability$/i.test(label) ? "Signature(?:\\s+Ability)?"
        : escaped
  const match = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?:['’]s)?(?![\\p{L}\\p{N}_])`, "iu").exec(condition)
  return match ? { before: condition.slice(0, match.index), text: match[0], after: condition.slice(match.index + match[0].length) } : null
}

type SynergyReference = Pick<ChampionKitSynergyLink, "key" | "label" | "synergyId" | "rarities"> & {
  level?: string; partnerRarities?: number[]; partnerRequirement?: string; variantLabel?: string
  details?: Array<{ text: string; ariaLabel: string }>
}
export type SynergySourceDisplay = Pick<ChampionKitSynergyLink, "conditions" | "resistance" | "values" | "bonus"> & {
  key: string
  champions: ChampionKitPartnerSources["champions"]
  partnerRarities?: number[]
  family?: string
  references: SynergyReference[]
}

const stars = (rarities?: number[]) => [...(rarities ?? [])].sort((a, b) => a - b).map(rarity => `${rarity}★`).join("/")

function knownPartnerRequirement(row: ChampionKitPartnerSources): { label: string; mode: string } | null {
  if (row.champions.length === 1) return row.partnerRarities?.length ? { label: stars(row.partnerRarities), mode: "SINGLE" } : null
  if (!row.champions.length || !row.partnerRequirement) return null
  let pattern = row.partnerRequirement.trim()
  for (const champion of row.champions) {
    const name = champion.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const member = new RegExp(`${name} \\([1-7]★(?:\\/[1-7]★)*\\)`, "gi")
    if ([...pattern.matchAll(member)].length !== 1) return null
    pattern = pattern.replace(member, "#")
  }
  if (!/^#(?:\s+(?:OR|AND)\s+#)+$/i.test(pattern)) return null
  const modes = new Set(pattern.match(/OR|AND/gi)?.map(mode => mode.toUpperCase()))
  return modes.size === 1 ? { label: row.partnerRequirement, mode: [...modes][0] } : null
}

/** Share current-effect copy, retaining each card's complete, correlated activation requirements. */
export function groupSynergySourceDisplay(rows: ChampionKitPartnerSources[]): SynergySourceDisplay[] {
  const result: SynergySourceDisplay[] = []
  const equivalent = new Map<string, SynergySourceDisplay>()
  for (const row of rows) for (const link of row.links) {
    const level = link.label.match(/^(.+?)\s+(?:-\s*)?Lv\.?\s*(\d+)$/i)
    const family = level?.[1] ?? link.label
    const requirement = knownPartnerRequirement(row)
    const reference: SynergyReference = { key: `${row.key}:${link.key}`, label: link.label, synergyId: link.synergyId,
      rarities: link.rarities, level: level?.[2], partnerRarities: row.partnerRarities, partnerRequirement: requirement?.label }
    // Owner and partner stars stay on each reference. Never union independent
    // partner ranges or assume that another recipient's bonus is identical.
    const canShare = requirement && link.rarities?.length && row.unique !== undefined && link.conditions.length
    const identity = canShare ? JSON.stringify([row.champions.map(champion => champion.slug ?? champion.name).sort(), family,
      !!level, requirement.mode, row.unique, [...link.conditions].sort(), link.resistance, link.values, link.bonus]) : null
    const previous = identity ? equivalent.get(identity) : undefined
    if (previous) {
      previous.references.push(reference)
      continue
    }
    const display: SynergySourceDisplay = { key: reference.key, champions: row.champions, partnerRarities: row.partnerRarities,
      family, references: [reference], conditions: link.conditions, resistance: link.resistance, values: link.values, bonus: link.bonus }
    result.push(display)
    if (identity) equivalent.set(identity, display)
  }
  for (const display of result) if (display.references.length > 1) {
    const activations = new Map<string, SynergyReference>()
    for (const reference of display.references) {
      const identity = JSON.stringify([reference.level, stars(reference.rarities), reference.partnerRequirement])
      const previous = activations.get(identity)
      if (previous) {
        if (previous.synergyId !== reference.synergyId) previous.synergyId = undefined
      } else activations.set(identity, reference)
    }
    display.references = [...activations.values()]
    const references = display.references
    const levelsVary = new Set(references.map(reference => reference.level)).size > 1
    const ownersVary = new Set(references.map(reference => stars(reference.rarities))).size > 1
    const partnersVary = new Set(references.map(reference => reference.partnerRequirement)).size > 1
    if (!levelsVary && references[0].level) display.family = references[0].label
    display.partnerRarities = !partnersVary ? references[0].partnerRarities : undefined
    references.sort((a, b) => Number(a.level ?? a.partnerRarities?.[0] ?? a.rarities?.[0]) - Number(b.level ?? b.partnerRarities?.[0] ?? b.rarities?.[0]))
    for (const reference of references) {
      const ownerLabel = `Champion ${stars(reference.rarities)}`
      const ownerIsLabel = !levelsVary && !partnersVary && ownersVary
      reference.variantLabel = levelsVary ? `Lv. ${reference.level}` : ownerIsLabel ? ownerLabel : reference.partnerRequirement
      reference.details = []
      if (levelsVary || ownerIsLabel && display.champions.length > 1) reference.details.push({ text: reference.partnerRequirement!,
        ariaLabel: display.champions.length === 1 ? `${display.champions[0].name} rarity: ${reference.partnerRarities!.join(", ")} stars` : `Partner requirements: ${reference.partnerRequirement}` })
      if (ownersVary && !ownerIsLabel) reference.details.push({ text: ownerLabel, ariaLabel: `Champion rarity: ${reference.rarities!.join(", ")} stars` })
    }
  }
  return result
}
