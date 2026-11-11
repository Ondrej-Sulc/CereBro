import { projectChampionEffects, type ChampionEffect, type ChampionEffectSource, type EffectEvidenceRecord } from '@cerebro/core/domain/champion-effects';
import { isChampionKitSourceAvailableAtRarity } from '@cerebro/core/domain/champion-kit';
import { getObtainableStarLevels } from './champion-obtainable';

export const GLOSSARY_GROUPS = [
  { id: 'ABILITY', label: 'Champions with this effect' },
  { id: 'IMMUNITY', label: 'Immune' },
  { id: 'RESISTANCE', label: 'Resistant' },
] as const;
export type GlossaryGroup = typeof GLOSSARY_GROUPS[number]['id'];
export type GlossaryParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
export function glossaryEffectId(value: string): number | null {
  return /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : null;
}
export const glossaryHref = (id: number) => `/glossary/${id}`;
export function normalizeGlossaryFilters(params: GlossaryParams) {
  const value = (key: string) => first(params[key]) ?? '';
  return {
    q: value('q').trim().slice(0, 100),
    category: glossaryEffectId(value('category')),
    page: /^\d{1,6}$/.test(value('page')) ? Math.max(1, Number(value('page'))) : 1,
    form: ['BUFF', 'DEBUFF', 'PASSIVE', 'UNKNOWN'].includes(value('form')) ? value('form') : '',
    direction: ['GAIN', 'INFLICT', 'UNKNOWN'].includes(value('direction')) ? value('direction') : '',
    stars: /^[1-7]$/.test(value('stars')) ? value('stars') : '',
    championClass: ['SCIENCE', 'SKILL', 'MUTANT', 'TECH', 'COSMIC', 'MYSTIC', 'SUPERIOR'].includes(value('class')) ? value('class') : '',
    group: (GLOSSARY_GROUPS.some(group => group.id === value('group')) ? value('group') : '') as GlossaryGroup | '',
  };
}
export type GlossaryFilters = ReturnType<typeof normalizeGlossaryFilters>;
export type GlossaryChampionInput = {
  id: number; name: string; slug: string | null; class: string; images: unknown;
  obtainable: string[]; isPlayable: boolean; abilities: ChampionEffectSource[];
};
export type GlossaryChampion = Omit<GlossaryChampionInput, 'abilities' | 'isPlayable'> & { stars: number[]; applications: ChampionEffect[] };

/** Shared canonical projection validates summaries and resistance receipts. Never classify by display name. */
export function projectGlossaryChampions(champions: GlossaryChampionInput[], evidence: EffectEvidenceRecord[], effectId: number, filters: GlossaryFilters) {
  const groups: Record<GlossaryGroup, GlossaryChampion[]> = { ABILITY: [], IMMUNITY: [], RESISTANCE: [] };
  for (const champion of champions) {
    const stars = getObtainableStarLevels(champion);
    if (!champion.isPlayable || !stars.length || (filters.stars && !stars.some(star => star === Number(filters.stars)))
      || (filters.championClass && champion.class !== filters.championClass)
      || (filters.q && !champion.name.toLowerCase().includes(filters.q.toLowerCase()))) continue;
    const effects = projectChampionEffects(champion.abilities, evidence).filter(effect => effect.ability.id === effectId
      && stars.some(star => isChampionKitSourceAvailableAtRarity(effect.source, star))
      && (!filters.stars || isChampionKitSourceAvailableAtRarity(effect.source, Number(filters.stars))));
    for (const group of GLOSSARY_GROUPS) {
      const applications = effects.filter(effect => effect.type === group.id && (group.id !== 'ABILITY'
        || ((!filters.form || effect.effectForm === filters.form) && (!filters.direction || effect.effectDirection === filters.direction))));
      if (!applications.length) continue;
      groups[group.id].push({ id: champion.id, name: champion.name, slug: champion.slug, class: champion.class,
        images: champion.images, obtainable: champion.obtainable, stars: [...stars], applications });
    }
  }
  for (const group of GLOSSARY_GROUPS) groups[group.id].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id - b.id);
  return groups;
}

export function glossaryPage<T>(rows: T[], requested: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pages, Math.max(1, requested));
  return { rows: rows.slice((page - 1) * size, page * size), page, pages, total: rows.length, size };
}

export function glossaryQuery(path: string, filters: GlossaryFilters, overrides: Record<string, string | number | null> = {}) {
  const values = { q: filters.q, category: filters.category, stars: filters.stars, class: filters.championClass,
    form: filters.form, direction: filters.direction, group: filters.group, page: filters.page, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value && !(key === 'page' && value === 1)) query.set(key, String(value));
  return `${path}${query.size ? `?${query}` : ''}`;
}
