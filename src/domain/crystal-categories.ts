/** Editorial browsing groups, separate from reward identity and live availability. */
export const CRYSTAL_CATEGORIES = [
  { id: "main", name: "Main pools", description: "Hero, Titan and progression pools." },
  { id: "classes", name: "Class & dual class", description: "Single-class, dual-class and class Nexus crystals." },
  { id: "featured", name: "Featured rotations", description: "Recorded versions of featured hero pools." },
  { id: "spotlight", name: "Champion spotlights", description: "Crystals with one promoted champion." },
  { id: "modes", name: "Incursions & rewards", description: "Incursions, Battlegrounds and Loyalty crystals." },
  { id: "calendar", name: "Login & daily", description: "Calendar login and daily reward crystals." },
  { id: "collections", name: "Year & era collections", description: "Pools organized around champion release years." },
  { id: "events", name: "Event & themed", description: "Seasonal events, celebrations and themed collections." },
  { id: "other", name: "Other recorded", description: "Other crystals and special reward definitions." },
] as const
export type CrystalCategoryId = typeof CRYSTAL_CATEGORIES[number]["id"]

export function isCrystalCategoryId(value: string | undefined): value is CrystalCategoryId {
  return CRYSTAL_CATEGORIES.some(category => category.id === value)
}

const classes = new Set(["COSMIC", "TECH", "MUTANT", "SKILL", "SCIENCE", "MYSTIC"])
const classPoolWords = new Set([...classes, "STAR", "HERO", "CRYSTAL", "NEXUS", "DUAL", "ABYSS", "ANTIQUATED", "CAVALIER", "GRANDMASTER", "MYTHIC", "LEGENDARY", "ULTIMATE", "VALIANT", "PARAGON", "PREMIUM"])

export function classifyCrystalCategory(crystal: {
  id: string; name: string; isMainPool: boolean; promotedChampionIds?: readonly string[]
}): CrystalCategoryId {
  if (crystal.isMainPool) return "main"
  const id = crystal.id.toLowerCase()
  const words = crystal.name.toUpperCase().match(/[A-Z0-9]+/g) ?? []
  if (/^(?:login_|24hr_|daily_)/.test(id)) return "calendar"
  if (/(?:^|_)(?:incursions?|battlegrounds?|loyalty)(?:_|$)/.test(id)) return "modes"
  if (words.some(word => classes.has(word)) && words.every(word => classPoolWords.has(word) || /^[1-7]$/.test(word))) return "classes"
  if (/^[4-7]fh_v\d+_shard_crystal$/.test(id) || /^FEATURED [4-7]-STAR HERO CRYSTAL$/.test(crystal.name.toUpperCase())) return "featured"
  if (/(?:^|_)20\d{2}_(?:champions|20\d{2})(?:_|$)/.test(id) || /^fh_featured_20\d{2}_crystal$/.test(id)) return "collections"
  if (/^meta_|(?:^|_)(?:banquet|anniversary|celebration|gifting|holiday|valentines?|halloween|womenofpower|pride|spring|summer|winter|lny|lunar|asgardian|avengers?|cinematic|mcu|collector|guardians|infinitywar|spiderverse|starktech|xmen|homecoming|covenant|romance|couples)(?:_|$)/.test(id)) return "events"
  if (/^(?:[pcv]fh|gmfh|fh)_/.test(id) && crystal.promotedChampionIds?.length === 1) return "spotlight"
  if (/^(?:[pcv]fh|gmfh|fh|cav|cavalier|paragon|valiant|mythic|legendary|ultimate)_/.test(id)) return "events"
  return "other"
}

/** Source edition labels identify recorded definitions, never current sale dates. */
export function crystalEditionLabel(sourceIds: readonly string[], category: CrystalCategoryId): string | null {
  const labels = new Set<string>()
  for (const id of sourceIds) {
    const version = category === "featured" ? id.match(/^[4-7]fh_v(\d+)_/) : null
    const calendar = category === "calendar" ? id.match(/_(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(\d{2})$/) : null
    const year = category === "collections" ? id.match(/(?:^|_)(20\d{2})(?:_(20\d{2}))?_(?:champions|annual|reflective|unforgettable)/) : null
    if (version) labels.add(`Pool v${version[1]}`)
    if (calendar) labels.add(`${calendar[1][0].toUpperCase()}${calendar[1].slice(1, 3)} 20${calendar[2]}`)
    if (year) labels.add(`${year[1]}${year[2] ? `–${year[2]}` : ""} collection`)
  }
  return labels.size > 1 ? `${labels.size} recorded editions` : [...labels][0] ?? null
}
