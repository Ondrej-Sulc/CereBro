/** Public effect metadata shared by catalog results and autocomplete. */
export type GlossarySearchOption = {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  color: string;
  secondaryColor: string;
  categories: { id: number; name: string }[];
  searchText?: string;
};

const plurals = new Set(['effects', 'buffs', 'debuffs', 'passives', 'charges', 'stacks', 'counters', 'reductions', 'resistances', 'bleeds', 'poisons', 'incinerates', 'shocks', 'ruptures']);
function normalize(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en')
    .replace(/\barmour\b/g, 'armor')
    // Search spelling only: this does not classify an effect as an immunity.
    .replace(/\bimmun(?:e|ity|ities)\b/g, 'immun')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
    .split(' ').map(word => plurals.has(word) ? word.slice(0, -1) : word).join(' ');
}
const matches = (words: string[], terms: string[]) => terms.every(term => /^\d+$/.test(term)
  ? words.includes(term) : words.some(word => word.startsWith(term)));

/** Name matches lead; all query terms must occur in public name/definition text. */
export function rankGlossarySearchOptions(options: readonly GlossarySearchOption[], query: string, limit = 7): GlossarySearchOption[] {
  const normalized = normalize(query);
  if (!normalized || !Number.isSafeInteger(limit) || limit <= 0) return [];
  const terms = normalized.split(' ');
  return options.map(option => {
    const name = normalize(option.name);
    const nameMatch = matches(name.split(' '), terms);
    const rank = name === normalized ? 0 : name.startsWith(normalized) ? 1 : nameMatch ? 2 : 3;
    const matched = nameMatch || matches(`${name} ${normalize(option.description ?? '')} ${normalize(option.searchText ?? '')}`.split(' '), terms);
    return { option, name, rank, matched };
  }).filter(row => row.matched)
    .sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name, 'en') || a.option.id - b.option.id)
    .slice(0, limit).map(row => row.option);
}
