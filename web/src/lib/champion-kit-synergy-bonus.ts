import type { ChampionKitAbilityTarget, ChampionKitEffect, ChampionKitSourceGroup, ChampionKitSynergyLink } from "./champion-kit"
import { buildSynergyCardContent, type ChampionSynergyCard } from "./champion-synergies"
import type { ResistanceValueContext } from "./champion-resistance-values"

export type SynergyBonusSource = { card: ChampionSynergyCard; rawCondition: string; target: ChampionKitAbilityTarget | null }
const normalize = (value: string) => value.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ")

/** Quote a complete imported duration bonus; retain the reviewed applications as separate details. */
export function recordedSynergyBonus(effect: ChampionKitEffect, group: ChampionKitSourceGroup, link: ChampionKitSynergyLink,
  inputs: Array<SynergyBonusSource | null>, context: ResistanceValueContext): ChampionKitSynergyLink["bonus"] {
  if (effect.type !== "ABILITY" || group.effectForm !== "DEBUFF" || group.effectDirection !== "INFLICT"
    || link.conditions.length < 2 || !context.championName || !inputs.length || inputs.some(input => !input)) return undefined
  const sources = inputs.filter((input): input is SynergyBonusSource => input !== null)
  const card = sources[0].card
  if (!link.synergyId || sources.some(source => source.card.id !== link.synergyId)) return undefined
  const recipients = [context.championName, ...(context.championAliases ?? [])].map(normalize)
  const rows = buildSynergyCardContent(card.description.replace(/(\[[0-9a-f]{6}(?:[0-9a-f]{2})?\][^\[\n:]+:\[-\])/gi, "\n$1"), card.unique).bonuses
  const bonuses = rows.flatMap(row => {
    const recipient = normalize(row.label.map(segment => segment.text).join("").replace(/:\s*$/, ""))
    if (!recipients.includes(recipient) && !["synergy champions", "all synergy champions", "all champions", "all teammates", "teammates"].includes(recipient)) return []
    const text = row.body.map(segment => segment.text).join("").trim()
    // Keep the whole supported clause, including awakening and signature alternatives.
    // Unfamiliar conditions or unresolved values retain the original presentation.
    const match = text.match(/^(?:If Awakened, gain )?(\d+(?:\.\d+)?)% increased Debuff duration\.(?: Otherwise, gain Level [1-9]\d* of [^.!?]+[’']s Signature Ability\.)?$/i)
    if (!match) return []
    const bound = sources.every(source => {
      const amounts = [...source.rawCondition.matchAll(/\b(\d+(?:\.\d+)?)%\s+increased\s+Debuff\s+duration\b/gi)]
      return amounts.length === 1 && amounts[0][1] === match[1]
    })
    return bound ? [text] : []
  })
  if (bonuses.length !== 1) return undefined
  const applications: NonNullable<ChampionKitSynergyLink["bonus"]>["sources"] = []
  for (const source of sources) {
    const native = group.nativeSources.find(native => source.target && native.target?.recordId === source.target.recordId)
    const target = native?.target
    if (!native || !target) return undefined
    if (!applications.some(application => application.target.recordId === target.recordId)) applications.push({ label: native.label, target })
  }
  if (applications.length !== link.conditions.length) return undefined
  return { text: bonuses[0], nonStacking: card.unique, sources: applications }
}
