import { clampAscensionLevelForRarity, clampSigForRarity, maxSigForRarity } from "./mcoc-prestige"
import { clampRecordedAscensionLevel, type ChampionAscensionRules } from "@cerebro/core/domain/champion-ascension"

export const CHAMPION_SECTIONS = ["overview", "abilities", "synergies", "stats", "crystals"] as const
export type ChampionSection = typeof CHAMPION_SECTIONS[number]
export type ChampionPageState = {
  tab: ChampionSection
  rarity: string
  rank: string
  sig: number
  ascension: number
  ability: string | null
  chapter: string | null
  synergy: string | null
}

export const CHAMPION_SYNERGY_HASH_PREFIX = "#champion-synergy-"

function validSynergyId(value: string | null) {
  if (!value || value.length > 200 || /\s/.test(value)) return null
  return [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ? null : value
}

export function readChampionSynergyHash(hash: string) {
  if (!hash.startsWith(CHAMPION_SYNERGY_HASH_PREFIX)) return null
  try { return validSynergyId(decodeURIComponent(hash.slice(CHAMPION_SYNERGY_HASH_PREFIX.length))) } catch { return null }
}

type StatTier = { rarity: number | null; rank: number }

export function readChampionPageState(params: Pick<URLSearchParams, "get">, stats: StatTier[], ascensionRules?: ReadonlyArray<Pick<ChampionAscensionRules, "rarity" | "maxLevel">>): ChampionPageState {
  const rarities = [...new Set(stats.flatMap(stat => stat.rarity ? [stat.rarity] : []))].sort((a, b) => b - a)
  const rarity = rarities.find(value => String(value) === params.get("rarity")) ?? rarities[0]
  const ranks = [...new Set(stats.filter(stat => stat.rarity === rarity).map(stat => stat.rank))].sort((a, b) => b - a)
  const rank = ranks.find(value => String(value) === params.get("rank")) ?? ranks[0]
  const tab = CHAMPION_SECTIONS.find(value => value === params.get("tab")) ?? "overview"
  const integer = (key: string, fallback: number) => {
    const value = params.get(key)
    return value && /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : fallback
  }
  const ability = params.get("ability")
  const chapter = params.get("chapter")
  return {
    tab,
    rarity: rarity == null ? "" : String(rarity),
    rank: rank == null ? "" : String(rank),
    sig: clampSigForRarity(integer("sig", maxSigForRarity(rarity)), rarity),
    ascension: ascensionRules === undefined ? clampAscensionLevelForRarity(integer("ascension", 0), rarity)
      : clampRecordedAscensionLevel(ascensionRules.find(rule => rule.rarity === rarity), integer("ascension", 0)),
    ability: tab === "abilities" && ability && /^\d+$/.test(ability) ? ability : null,
    chapter: tab === "abilities" && chapter && chapter !== "all" && /^[a-z][a-z0-9_-]{0,63}$/.test(chapter) ? chapter : null,
    synergy: tab === "synergies" ? validSynergyId(params.get("synergy")) : null,
  }
}

export function championPageSearchParams(current: string, state: ChampionPageState) {
  const params = new URLSearchParams(current)
  params.set("tab", state.tab)
  for (const key of ["rarity", "rank", "sig", "ascension"] as const) {
    if (state[key] !== "") params.set(key, String(state[key]))
    else params.delete(key)
  }
  if (state.tab === "abilities" && state.ability) params.set("ability", state.ability)
  else params.delete("ability")
  if (state.tab === "abilities" && state.chapter) params.set("chapter", state.chapter)
  else params.delete("chapter")
  if (state.tab === "synergies" && state.synergy) params.set("synergy", state.synergy)
  else params.delete("synergy")
  return params
}

export function championPageHref(currentHref: string, state: ChampionPageState, clearLegacyTarget = false) {
  const url = new URL(currentHref)
  url.search = championPageSearchParams(url.search, state).toString()
  if (url.hash.startsWith(CHAMPION_SYNERGY_HASH_PREFIX) && (state.tab !== "synergies" || state.synergy || clearLegacyTarget)) url.hash = ""
  return `${url.pathname}${url.search}${url.hash}`
}
