export type ChampionScope = "playable" | "nonPlayable" | "all";

export const CHAMPION_SCOPE_LABELS: Record<ChampionScope, string> = {
  playable: "Playable",
  nonPlayable: "NPC & legacy",
  all: "Any availability",
};

export function normalizeChampionScope(value: unknown): ChampionScope {
  return value === "nonPlayable" || value === "all" ? value : "playable";
}

/** Partial owned-roster payloads predate this flag; only explicit false denotes an NPC. */
export function matchesChampionScope(champion: { isPlayable?: boolean }, scope: ChampionScope = "playable") {
  return scope === "all" || (scope === "nonPlayable" ? champion.isPlayable === false : champion.isPlayable !== false);
}

export function championScopeHref(href: string, scope: ChampionScope) {
  const url = new URL(href);
  if (scope === "playable") url.searchParams.delete("championScope");
  else url.searchParams.set("championScope", scope);
  return `${url.pathname}${url.search}${url.hash}`;
}
