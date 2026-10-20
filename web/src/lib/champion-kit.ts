import { formatGameText, type PreparedChampionAbilityTextNode, type PreparedChampionAbilityTextView } from "./champion-ability-text"
import { readAbilitySource, type EffectSourceMetadata, type EffectForm, type EffectDirection } from "@cerebro/core/domain/ability-source"
import type { ChampionSynergyCard } from "./champion-synergies"

type KitChampion = { name: string; slug: string | null; images: unknown }
type KitLink = Partial<EffectSourceMetadata> & {
  id: number
  type: "ABILITY" | "IMMUNITY"
  source: string | null
  overviewSummary?: string | null
  ability: { name: string; description?: string | null; iconUrl?: string | null; gameGlossaryTermId?: string | null }
  synergyChampions: Array<{ champion: KitChampion }>
}
type KitGlossary = { description: string | null; raw: unknown; iconUrl?: string | null }

export type ChampionKitEffect = {
  name: string
  type: KitLink["type"]
  iconUrl: string | null
  color: string
  secondaryColor: string
  description: string | null
  sources: Array<EffectSourceMetadata & { label: string; rawLabel: string; overviewSummary?: string | null; champions: KitChampion[] }>
}

export type ChampionKitFilters = { effectForm: EffectForm | "ALL"; effectDirection: EffectDirection | "ALL" }

/** Both filters must match the same source, not separate applications of an effect. */
export function filterChampionKitEffects(effects: ChampionKitEffect[], filters: ChampionKitFilters): ChampionKitEffect[] {
  return effects.flatMap(effect => {
    const sources = effect.sources.filter(source => (filters.effectForm === "ALL" || source.effectForm === filters.effectForm)
      && (filters.effectDirection === "ALL" || source.effectDirection === filters.effectDirection))
    return sources.length ? [{ ...effect, sources }] : []
  })
}

/** Split sources, not whole effects: a champion can both gain and inflict the same effect. */
export function groupChampionKitAbilitiesByDirection(effects: ChampionKitEffect[]): Array<{ direction: EffectDirection; effects: ChampionKitEffect[] }> {
  const abilities = effects.filter(effect => effect.type === "ABILITY")
  return (["GAIN", "INFLICT", "UNKNOWN"] as const).flatMap(direction => {
    const grouped = filterChampionKitEffects(abilities, { effectForm: "ALL", effectDirection: direction })
    return grouped.length ? [{ direction, effects: grouped }] : []
  })
}

export type ChampionKitAbilityTarget = { recordId: string; chapter: string; title: string }

/** Overview labels describe the primary source, never the mechanics that follow it. */
export function summarizeChampionKitSource(value: string): string {
  const source = formatGameText(readAbilitySource({ source: value }).condition).replaceAll("_", " ").trim()
  if (/^(?:signature(?: ability)?|dupe|awakened)\b/i.test(source)) return "Signature ability"
  const specials = source.match(/^(?:(?:on|during|after|activating)\s+)?(?:sp|special(?: attack)?)[\s-]*[123](?:\s*(?:[,/&]|and|or)\s*(?:sp|special(?: attack)?)[\s-]*[123])*/i)
  if (specials) {
    const numbers = [...specials[0].matchAll(/[123]/g)].map(match => match[0])
    return `Special ${[...new Set(numbers)].join(" & ")}`
  }
  if (/^(?:(?:while|when)\s+)?charg(?:ing|e)\s+(?:a\s+|the\s+)?heavy\b/i.test(source)) return "Charging Heavy"
  if (/^heavy\s+(?:(?:first|final|last)\s+)?(?:attacks?|hits?)\b/i.test(source)) return "Heavy attacks"
  if (/^light\s+(?:and|&)\s+medium\s+attacks?\b/i.test(source)) return "Light & Medium attacks"
  if (/^medium,?\s+heavy\s+and\s+light\b/i.test(source)) return "Basic & Heavy attacks"
  if (/^(?:basic|all basic)\s+attacks?\b/i.test(source)) return "Basic attacks"
  if (/^light\s+attacks?\b/i.test(source)) return "Light attacks"
  if (/^medium\s+attacks?\b/i.test(source)) return "Medium attacks"
  if (/^(?:at\s+)?(?:the\s+)?(?:start|beginning)\s+of\s+(?:the\s+)?fight\b|^start(?:s)?\s+(?:the\s+)?fight\b/i.test(source)) return "Fight start"
  if (/^(?:(?:while|when)\s+)?blocking\b|^on\s+(?:a\s+)?(?:well-timed\s+)?block\b/i.test(source)) return "Blocking"
  if (/^(?:when|after|on|upon)\s+(?:(?:a|an|the|successful|personal)\s+)*intercept\b/i.test(source)) return "Intercepts"
  if (/^(?:when|after|on|upon)\s+(?:(?:a|an|the|successful|personal)\s+)*(?:evad(?:e|ing)|dodge)\b/i.test(source)) return "After evading"
  if (/^(?:when(?:ever)?|while|if)\s+(?:the\s+)?opponent\s+(?:gains?|receives?)\s+(?:a\s+|any\s+)?buffs?\b/i.test(source)) return "Opponent gains Buffs"
  if (/^(?:when(?:ever)?|while|if)\s+(?:the\s+)?opponent\s+has\s+(?:a\s+|any\s+)?buffs?\b/i.test(source)) return "Opponent has Buffs"
  const eitherChampion = source.match(/^when(?:ever)?\s+either champion\s+intercepts?(?:\s+or\s+punishes?\s+a\s+special)?/i)
  if (eitherChampion) return /punish/i.test(eitherChampion[0]) ? "Either champion intercepts / punishes" : "Either champion intercepts"
  const inside = source.match(/^(?:while|when|if)\s+(?:the\s+)?(.+?)\s+(?:is\s+)?inside\s+(?:the\s+)?([^,.;]+)/i)
  if (inside && inside[2].length <= 32 && !/[{}]/.test(inside[2])) return /^opponent$/i.test(inside[1]) ? `Opponent in ${inside[2]}` : `Inside ${inside[2]}`
  if (/^when(?:ever)?\s+(?:a\s+)?(?:personal\s+)?shock\b[^.;]*\bfails?\b/i.test(source)) return "Shock fails to apply"
  if (/^when\s+the\s+opponent\s+moves?\s+into\s+(?:an?\s+armed\s+)?sable mine\b/i.test(source)) return "Sable Mine triggered"
  if (/^as\s+an?\s+attacker\b/i.test(source)) return "As attacker"
  if (/^as\s+an?\s+defender\b/i.test(source)) return "As defender"
  if (/^always\s+active\b|^at\s+all\s+times\b/i.test(source)) return "Always active"
  if (/^eligible copy:/i.test(source)) return "Copy opponent Buffs"
  const condition = source.match(/^(?:when(?:ever)?|while|if|after|during|until|on|upon)\b[^,:;.]+/)?.[0]
  if (condition && condition.length <= 56 && !/[{}]|\b(?:unresolved|legacy|gain|gains|inflict|inflicts|grant|grants|deal|deals)\b/i.test(condition)) return condition
  if (/^(?:when(?:ever)?|while|if|after|during|until)\b/i.test(source)) return "Conditional"
  return "Base kit"
}

/** Keep every source and teammate requirement; only its displayed prose becomes a summary. */
export function buildChampionKitOverviewEffects(items: KitLink[], glossary: Map<string, KitGlossary>, rarity?: number): ChampionKitEffect[] {
  const applicable = items.filter(item => isChampionKitSourceAvailableAtRarity(item.source, rarity))
  return buildChampionKitEffects(applicable, glossary).map(effect => ({
    ...effect,
    sources: effect.sources.map(source => ({
      ...source,
      label: source.champions.length || /^synergy\b/i.test(source.rawLabel) ? "Synergy" : summarizeChampionKitSource(source.label),
    })),
  }))
}

export function isChampionKitSourceAvailableAtRarity(source: string | null, rarity?: number): boolean {
  const requirements = readKitSynergyHeader(source ?? "")
  return !rarity || !requirements || requirements.rarities.includes(rarity)
}

type KitSynergyHeader = { name: string; rarities: number[]; partners: string; unique: boolean; condition: string }

/** Only the canonical imported header establishes star requirements; legacy prose stays visible. */
function readKitSynergyHeader(source: string): KitSynergyHeader | null {
  const match = source.match(/^\s*Synergy:\s*(.+?)\s+\(([1-7]★(?:\/[1-7]★)*)\)\s+with\s+(.+?)(; does not stack)?:\s*/i)
  return match ? { name: match[1], rarities: [...match[2].matchAll(/[1-7]/g)].map(item => Number(item[0])), partners: match[3], unique: !!match[4], condition: source.slice(match[0].length).trim() } : null
}

export type ChampionKitNativeSource = { key: string; label: string; condition: string; target: ChampionKitAbilityTarget | null }
export type ChampionKitSynergyLink = { key: string; label: string; conditions: string[]; synergyId?: string }
export type ChampionKitPartnerSources = { key: string; champions: KitChampion[]; links: ChampionKitSynergyLink[] }
export type ChampionKitSourceGroup = EffectSourceMetadata & {
  key: string
  nativeSources: ChampionKitNativeSource[]
  synergies: ChampionKitPartnerSources[]
}

function overviewCondition(recordedCondition: string, summary?: string | null): string {
  const recorded = recordedCondition.trim()
  // Neither an effect name nor a saved summary establishes a missing source condition.
  if (!recorded || /^synergy\s*$/i.test(recorded)) return ""
  const condition = summary?.trim() || recorded
  // Unavailable summaries must not expose the internal evidence/audit prose instead.
  // Leave the condition blank rather than stripping qualifiers or guessing missing values.
  return condition.length <= 360 && !/[{}]|\b(?:unresolved|legacy|audit)\b|\b(?:text|link|addition):\s*\d+|\bvalue\s+(?:missing|not recorded)/i.test(condition)
    ? condition : ""
}

export function groupChampionKitSources(effect: ChampionKitEffect, view: PreparedChampionAbilityTextView, synergyCards: ChampionSynergyCard[] = []): ChampionKitSourceGroup[] {
  const groups = new Map<string, ChampionKitSourceGroup>()
  for (const source of effect.sources) {
    const key = `${source.effectForm}:${source.effectDirection}`
    const group: ChampionKitSourceGroup = groups.get(key) ?? { key, effectForm: source.effectForm, effectDirection: source.effectDirection, nativeSources: [], synergies: [] }
    groups.set(key, group)
    const synergy = source.champions.length > 0 || /^synergy\b/i.test(source.rawLabel)
    const header = synergy ? readKitSynergyHeader(source.rawLabel) : null
    const recordedCondition = header?.condition ?? readAbilitySource({ ...source, source: source.rawLabel }).condition
    const condition = overviewCondition(recordedCondition, source.overviewSummary)
    if (!synergy) {
      if (!condition) continue
      // Match against the original condition; identical short labels do not imply identical passages.
      const target = findChampionKitAbilityTarget(effect.name, source.rawLabel, view, source.label)
      const sourceKey = `${target?.recordId ?? ""}:${source.rawLabel.trim().replace(/\s+/g, " ").toLowerCase()}:${source.overviewSummary ?? ""}`
      let label = source.label
      if (["Conditional", "Base kit"].includes(label) && target && ![normalizedWords(effect.name), "always active", "attack details"].includes(normalizedWords(target.title)) && target.title.length <= 48 && !/[{}]|text:\d+|unresolved|legacy/i.test(target.title)) label = target.title
      if (!group.nativeSources.some(item => item.key === sourceKey)) group.nativeSources.push({ key: sourceKey, label, condition, target })
      continue
    }
    const partnersKey = source.champions.map(champion => champion.slug ?? champion.name).sort().join("|")
    const requirementKey = header ? `${normalizedWords(header.partners)}:${header.unique}` : source.rawLabel
    const rowKey = `${partnersKey}:${requirementKey}`
    let row = group.synergies.find(item => item.key === rowKey)
    if (!row) {
      row = { key: rowKey, champions: source.champions, links: [] }
      group.synergies.push(row)
    }
    const matchingCards = header ? synergyCards.filter(card => normalizedWords(card.name) === normalizedWords(header.name)
      && card.unique === header.unique && sameSynergyPartners(card, source.champions, header.partners)) : []
    const synergyId = matchingCards.length === 1 ? matchingCards[0].id : undefined
    const linkKey = synergyId ?? source.rawLabel
    let link = row.links.find(link => link.key === linkKey)
    if (!link) {
      link = { key: linkKey, label: header ? sourceLabel(header.name)! : "Team bonus", conditions: [], synergyId }
      row.links.push(link)
    }
    if (condition && !link.conditions.includes(condition)) link.conditions.push(condition)
  }
  return [...groups.values()].filter(group => group.nativeSources.length || group.synergies.length)
}

function sameSynergyPartners(card: ChampionSynergyCard, champions: KitChampion[], requirements: string): boolean {
  if (card.partners.length !== champions.length) return false
  return card.partners.every(partner => {
    if (!champions.some(champion => (champion.slug ?? champion.name) === (partner.slug ?? partner.name))) return false
    const escapedName = partner.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const recorded = requirements.match(new RegExp(`${escapedName} \\(([1-7]★(?:\\/[1-7]★)*)\\)`, "i"))
    if (!recorded) return false
    const stars = [...recorded[1].matchAll(/[1-7]/g)].map(item => Number(item[0])).sort()
    return stars.join(",") === [...partner.rarities].sort().join(",")
  })
}

export function getChampionKitSourceTags(label: string, synergy: boolean): string[] {
  const tags: string[] = []
  if (synergy) tags.push("Synergy")
  if (/\bheavy\b/i.test(label)) tags.push("Heavy")
  if (/\b(?:light|medium|basic) attacks?\b/i.test(label)) tags.push("Basic attacks")
  const specials = [...label.matchAll(/\b(?:sp|special(?:\s+attack)?)[\s-]*([123])\b/gi)]
  tags.push(...[...new Set(specials.map(match => `SP${match[1]}`))])
  if (!specials.length && /\b(?:sp|sps|special(?:\s+attacks?)?)\b/i.test(label)) tags.push("Special attacks")
  if (/\b(?:signature|dupe|awakened)\b/i.test(label)) tags.push("Signature")
  if (/\bstart(?:\s+of)?\s+(?:the\s+)?fight\b/i.test(label)) tags.push("Fight start")
  return tags
}

export function findChampionKitAbilityTarget(
  effectName: string,
  source: string,
  view: PreparedChampionAbilityTextView,
  primarySource = source,
): ChampionKitAbilityTarget | null {
  const key = normalizedWords(effectName)
  if (!key) return null
  const tags = getChampionKitSourceTags(primarySource, false)
  const sourceWords = matchingWords(source)
  const panels = [view.signaturePanel, ...view.descriptionPanels]
  const candidates = panels.flatMap(panel => panel.recordGroups.flatMap(group => group.records.flatMap(record => {
    if (record.prepared.status !== "ready") return []
    const text = normalizedWords(record.prepared.blocks.map(block => abilityNodeText(block.children)).join(" "))
    const headingMatch = normalizedWords(group.title) === key
    // Whole words avoid linking effects such as Power Gain to unrelated power text.
    const names = [key, `${key}s`, ...(key.endsWith("y") ? [`${key.slice(0, -1)}ies`] : [])]
    const textMatch = names.some(name => ` ${text} `.includes(` ${name} `))
    // A heading alone can be a standalone glossary definition, without the trigger.
    if (!textMatch) return []
    const special = tags.find(tag => /^SP[123]$/.test(tag))
    const passageWords = matchingWords(text)
    let score = (headingMatch ? 15 : 0) + [...sourceWords].filter(word => passageWords.has(word)).length * 12
    if (special && (panel.group === `special${special.slice(-1)}` || panel.specialAttackNumbers?.includes(Number(special.slice(-1))))) score += 100
    if (tags.includes("Heavy") && /\bheavy\b/i.test(group.title)) score += 90
    if (/^signature\b/i.test(primarySource) && panel.group === "signature") score += 100
    if (panel.group === "base") score += 10
    return [{ recordId: String(record.id), chapter: panel.group, title: group.title || panel.title, score }]
  })))
  candidates.sort((a, b) => b.score - a.score)
  const target = candidates[0]
  return target ? { recordId: target.recordId, chapter: target.chapter, title: target.title } : null
}

function normalizedWords(value: string) {
  return formatGameText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function matchingWords(value: string) {
  const ignored = new Set(["the", "and", "for", "with", "when", "while", "during", "after", "over", "from", "passive", "debuff", "signature", "dupe", "attack", "attacks", "special", "max", "first", "time"])
  // Build-scaled numbers are not passage identities (e.g. 5% can accidentally match a 0.5s pause).
  return new Set(normalizedWords(value).split(" ").filter(word => !ignored.has(word) && word.length > 2 && !/^\d+$/.test(word))
    .map(word => word.length > 3 ? word.replace(/s$/, "") : word))
}

function abilityNodeText(nodes: PreparedChampionAbilityTextNode[]): string {
  return nodes.map(node => node.type === "color" ? abilityNodeText(node.children)
    : node.type === "text" ? node.value
      : node.type === "glossary" ? node.label
        : node.resolution.status === "resolved" ? node.resolution.displayValue : " ").join("")
}

export function buildChampionKitEffects(items: KitLink[], glossary: Map<string, KitGlossary>): ChampionKitEffect[] {
  const groups = new Map<string, ChampionKitEffect>()
  for (const item of items) {
    const key = `${item.type}:${item.ability.name}`
    const term = glossary.get(item.ability.gameGlossaryTermId ?? item.ability.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"))
    const raw = term?.raw && typeof term.raw === "object" ? term.raw as Record<string, unknown> : undefined
    const description = item.ability.description?.trim() || term?.description?.trim() || (typeof raw?.description === "string" ? raw.description : null)
    const group: ChampionKitEffect = groups.get(key) ?? {
      name: item.ability.name,
      type: item.type,
      iconUrl: item.ability.iconUrl ?? term?.iconUrl ?? null,
      ...getGameEffectColors(term?.raw),
      description: description ? formatGameText(description) : null,
      sources: [],
    }
    const champions = [...new Map(item.synergyChampions.map(({ champion }) => [champion.slug ?? champion.name, champion])).values()]
      .sort((a, b) => a.name.localeCompare(b.name))
    const { condition, effectForm, effectDirection } = readAbilitySource(item)
    const rawLabel = sourceLabel(item.source) ?? ""
    const label = sourceLabel(condition) ?? (effectForm !== "UNKNOWN" || effectDirection !== "UNKNOWN" ? "" : champions.length ? "Synergy" : "Source not recorded")
    const sameSource = group.sources.some(source => source.label === label
      && source.overviewSummary === item.overviewSummary
      && source.effectForm === effectForm && source.effectDirection === effectDirection
      && source.champions.map(champion => champion.slug ?? champion.name).join("|") === champions.map(champion => champion.slug ?? champion.name).join("|"))
    if (!sameSource) group.sources.push({ label, rawLabel, overviewSummary: item.overviewSummary, champions, effectForm, effectDirection })
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function getGameEffectColors(raw: unknown) {
  const entry = raw && typeof raw === "object" ? raw as Record<string, unknown> : undefined
  const normalize = (value: unknown) => typeof value === "string" && /^#?[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)
    ? `#${value.replace(/^#/, "").slice(0, 6)}` : undefined
  return { color: normalize(entry?.color_primary) ?? "#b8c5d6", secondaryColor: normalize(entry?.color_secondary) ?? "#263142" }
}

function sourceLabel(value: string | null) {
  if (!value?.trim()) return null
  const label = formatGameText(value.trim().replaceAll("_", " "))
  return label === label.toUpperCase() ? label.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) : label
}
