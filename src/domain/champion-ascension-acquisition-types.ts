/** Client-safe DTOs only. No catalog, validation runtime or game datasets. */
export type AscensionAcquisitionEvidence = {
  id: string
  title: string
  kind: "official_announcement" | "official_stream_summary" | "static_store" | "quest_capture"
  publisher: string
  creditedTo?: string
  url?: string
  publishedAt: string | null
  reviewedAt: string
  capturedAt?: string
  /** Filesystem provenance only; never an offer/observation start date. */
  fileModifiedAt?: string
  fileName?: string
  sha256?: string
}

export type AscensionAcquisitionWindow = {
  /** Date-only values retain calendar precision; null means unestablished. */
  start: string | null
  end: string | null
  timeZone: string | null
  label: string
}
export type AscensionAcquisitionReward = {
  type: "inv" | "hero" | "res"
  id: string
  quantity: number
  role: "ascension_material" | "champion" | "other"
  name?: string | null
  imageUrl?: string | null
}
export type AscensionAcquisitionOffer = {
  id: string
  label: string
  /** Every offer is one evidence version: historical prices never attach to newer contents. */
  sourceId: string
  binding: string | null
  rewards: AscensionAcquisitionReward[]
  price: { currency: string; quantity: number } | null
  purchaseLimit: number | null
  conditions: string[]
}
export type ChampionAscensionAcquisitionRoute = {
  id: string
  gameId: string
  rarity: number
  kind: "exchange" | "challenge" | "event" | "sale" | "quest" | "definition"
  title: string
  description: string
  confidence: "high" | "partial" | "definition_only"
  starScope: "explicit" | "recorded_path_match"
  requiredTokenIds: string[]
  availability: "historical" | "upcoming" | "activity_dependent" | "current_stock_unverified" | "definition_only"
  periodStatus: "past" | "upcoming" | "within_announced_period" | "start_passed_end_unknown" | "not_dated"
  window: AscensionAcquisitionWindow | null
  conditions: string[]
  missingEvidence: string[]
  offers: AscensionAcquisitionOffer[]
  sources: AscensionAcquisitionEvidence[]
}
export type ChampionAscensionMaterialPath = {
  rarity: number
  state: "recorded_path" | "recorded_empty" | "unknown"
  blueprintId: string | null
  observedAt: string | null
  maxLevel: number | null
  materialKind: "shared" | "champion_specific" | null
  steps: Array<{ level: number; costs: Array<{ type: "inv" | "res"; id: string; quantity: number; name: string | null; imageUrl?: string | null }> }>
  guidance: string
  materialFinderHref: string | null
}
export type ChampionAscensionAcquisitionSources = {
  gameId: string
  reviewedAt: string
  evaluatedAsOf: string
  accountStatus: "unverified"
  paths: ChampionAscensionMaterialPath[]
  routes: ChampionAscensionAcquisitionRoute[]
  /** Static definitions are deliberately outside the obtainable-method rows. */
  definitions: ChampionAscensionAcquisitionRoute[]
}
