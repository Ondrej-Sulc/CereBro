/** The public projection needed by both the server results and client suggestions. */
export type RewardSearchOption = {
  key: string;
  name: string;
  href: string;
  imageUrl: string | null;
  sources: number;
  rarity: number | null;
};

export const rewardSearchLabel = (option: RewardSearchOption) => `${option.rarity ? `${option.rarity}★ ` : ""}${option.name}`;

const rewardPlurals = new Set(["crystals", "catalysts", "gems", "selectors", "tokens", "fragments", "shards", "stones", "badges", "resources", "rewards", "boosts"]);

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/(\d+)\s*[-‐‑–—]?\s*(?:stars?\b|\*|★|☆)/g, "$1 star ")
    .replace(/\brank\s*up\b/g, "rank up")
    .replace(/\biso[\s-]*8\b/g, "iso 8")
    .replace(/\b(?:tier\s*|t)(\d+)\b/g, "tier $1")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ")
    .split(" ").map(word => rewardPlurals.has(word) ? word.slice(0, -1) : word).join(" ");
}

function matchesTerms(words: string[], terms: string[]) {
  return terms.every(term => /^\d+$/.test(term)
    ? words.includes(term)
    : words.some(word => word.startsWith(term)));
}

export function matchesRewardSearch(option: RewardSearchOption, query: string) {
  const normalized = normalize(query);
  return !normalized || matchesTerms(normalize(rewardSearchLabel(option)).split(" "), normalized.split(" "));
}

/** Exact labels and prefixes lead; every term must match, including exact numbers. */
export function rankRewardSearchOptions(options: readonly RewardSearchOption[], query: string, limit = 7): RewardSearchOption[] {
  const normalized = normalize(query);
  if (!normalized || !Number.isSafeInteger(limit) || limit <= 0) return [];
  const terms = normalized.split(" ");
  return options.map(option => ({ option, label: normalize(rewardSearchLabel(option)) }))
    .filter(({ label }) => matchesTerms(label.split(" "), terms))
    .map(row => ({ ...row, rank: row.label === normalized ? 0 : row.label.startsWith(normalized) ? 1 : row.label.includes(normalized) ? 2 : 3 }))
    .sort((a, b) => a.rank - b.rank || a.label.length - b.label.length || a.label.localeCompare(b.label) || a.option.key.localeCompare(b.option.key))
    .slice(0, limit).map(row => row.option);
}
