export const EFFECT_FORMS = ["BUFF", "DEBUFF", "PASSIVE", "UNKNOWN"] as const
export const EFFECT_DIRECTIONS = ["GAIN", "INFLICT", "UNKNOWN"] as const
export type EffectForm = typeof EFFECT_FORMS[number]
export type EffectDirection = typeof EFFECT_DIRECTIONS[number]
export type EffectSourceMetadata = { effectForm: EffectForm; effectDirection: EffectDirection }
export const EFFECT_FORM_LABELS: Record<EffectForm, string> = { BUFF: "Buff", DEBUFF: "Debuff", PASSIVE: "Passive", UNKNOWN: "Not recorded" }
export const EFFECT_DIRECTION_LABELS: Record<EffectDirection, string> = { GAIN: "Gains", INFLICT: "Inflicts", UNKNOWN: "Not recorded" }

type SourceInput = { source?: string | null; effectForm?: EffectForm | null; effectDirection?: EffectDirection | null }

/** Only leading metadata is removed. Conditions about an opponent's Buffs stay intact. */
export function readAbilitySource(input: SourceInput): EffectSourceMetadata & { condition: string } {
  const original = input.source?.trim() ?? ""
  // Keep activation/teammate requirements when old entries put metadata after them.
  const wrapped = original.match(/^(Synergy: .+?\s+—\s+|(?:Dupe|Signature(?: Ability)?)\s*[,;:]\s*)(.+)$/i)
  if (wrapped) {
    const nested = readAbilitySource({ ...input, source: wrapped[2] })
    return { ...nested, condition: nested.condition ? wrapped[1] + nested.condition : wrapped[1].replace(/(?:\s+—|[,;:])\s*$/, "").trim() }
  }
  let condition = original
  const forms = new Set<EffectForm>()
  const directions = new Set<EffectDirection>()
  let prefix: RegExpMatchArray | null
  while ((prefix = condition.match(/^(buff|debuff|passive|gains?|inflicts?)\s*(?:[,;:]\s*|$)/i))) {
    const token = prefix[1].toUpperCase()
    if (token.startsWith("GAIN")) directions.add("GAIN")
    else if (token.startsWith("INFLICT")) directions.add("INFLICT")
    else forms.add(token as EffectForm)
    condition = condition.slice(prefix[0].length).trim()
  }
  // Mixed legacy annotations must be split/curated, rather than silently losing meaning.
  if (forms.size > 1 || directions.size > 1) condition = original
  return {
    condition,
    effectForm: input.effectForm && input.effectForm !== "UNKNOWN" ? input.effectForm : forms.size === 1 ? [...forms][0] : "UNKNOWN",
    effectDirection: input.effectDirection && input.effectDirection !== "UNKNOWN" ? input.effectDirection : directions.size === 1 ? [...directions][0] : "UNKNOWN",
  }
}

/** Plain-text clients retain source tags when the condition no longer repeats them. */
export function formatAbilitySource(input: SourceInput): string {
  const source = readAbilitySource(input)
  const tags = [source.effectForm !== "UNKNOWN" ? EFFECT_FORM_LABELS[source.effectForm] : "",
    source.effectDirection !== "UNKNOWN" ? EFFECT_DIRECTION_LABELS[source.effectDirection] : ""].filter(Boolean).join(" · ")
  return [tags, source.condition].filter(Boolean).join(" — ")
}
