import { cache } from 'react';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatGameText, prepareChampionAbilityTextView } from '@cerebro/core/domain/champion-ability-text/renderer';
import { buildChampionKitOverviewEffects, findChampionKitAbilityTarget, getGameEffectColors, groupChampionKitSources, summarizeChampionKitSource } from '@cerebro/core/domain/champion-kit';
import { resistanceEvidenceRecords } from '@cerebro/core/domain/champion-resistance-classification';
import { buildChampionSynergyView } from '@cerebro/core/domain/champion-synergies';
import { glossaryEffectId, glossaryPage, isSynergyApplication, normalizeGlossaryFilters, projectGlossaryChampions, type GlossaryParams, type GlossaryChampionInput } from '../effect-glossary';

const effectSelect = {
  id: true, name: true, description: true, iconUrl: true, gameGlossaryTermId: true,
  gameGlossaryTerm: { select: { description: true, iconUrl: true, raw: true } },
  categories: { select: { id: true, name: true, description: true } },
} as const satisfies Prisma.AbilitySelect;
type EffectRow = Prisma.AbilityGetPayload<{ select: typeof effectSelect }>;
function presentEffect(effect: EffectRow) {
  const description = effect.description?.trim() || effect.gameGlossaryTerm?.description?.trim();
  return { id: effect.id, name: effect.name, description: description ? formatGameText(description) : null,
    iconUrl: effect.iconUrl || effect.gameGlossaryTerm?.iconUrl || null,
    ...getGameEffectColors(effect.gameGlossaryTerm?.raw), categories: effect.categories };
}
export type GlossaryEffect = ReturnType<typeof presentEffect>;
export const getGlossaryEffect = cache(async (identity: string) => {
  const id = glossaryEffectId(identity);
  if (!id) return null;
  const row = await prisma.ability.findUnique({ where: { id }, select: effectSelect });
  return row ? presentEffect(row) : null;
});

export async function loadEffectGlossary(params: GlossaryParams) {
  const filters = normalizeGlossaryFilters(params);
  const where: Prisma.AbilityWhereInput = {
    ...(filters.q ? { OR: [{ name: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
      { gameGlossaryTerm: { description: { contains: filters.q, mode: 'insensitive' } } }] } : {}),
    ...(filters.category ? { categories: { some: { id: filters.category } } } : {}),
  };
  const [total, categories, catalogTotal] = await Promise.all([
    prisma.ability.count({ where }),
    prisma.abilityCategory.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, description: true, _count: { select: { abilities: true } } } }),
    prisma.ability.count(),
  ]);
  const size = 24, pages = Math.max(1, Math.ceil(total / size)), page = Math.min(filters.page, pages);
  const rows = await prisma.ability.findMany({ where, select: effectSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: size, skip: (page - 1) * size });
  return { filters: { ...filters, page }, categories, catalogTotal, results: { rows: rows.map(presentEffect), total, pages, page, size } };
}

const championSelect = { id: true, name: true, slug: true, class: true, images: true, obtainable: true, isPlayable: true } as const;
export async function loadGlossaryDetail(identity: string, params: GlossaryParams) {
  const effect = await getGlossaryEffect(identity);
  if (!effect) return null;
  const filters = normalizeGlossaryFilters(params);
  // Only this effect's applications and incoming protections. No roster, player or full champion payloads.
  const links = await prisma.championAbilityLink.findMany({
    where: { champion: { isPlayable: true }, OR: [{ abilityId: effect.id }, { resistances: { some: { effectId: effect.id } } }] },
    include: {
      champion: { select: championSelect }, ability: { select: { id: true, name: true } },
      overviewSummary: { select: { text: true, sourceHash: true } },
      synergyChampions: { include: { champion: { select: { id: true, name: true, slug: true, images: true, class: true } } } },
      resistances: { include: { effect: { select: { id: true, name: true } } } },
    }, orderBy: { id: 'asc' },
  });
  const evidenceIds = [...new Set(links.flatMap(link => link.resistances.flatMap(row => resistanceEvidenceRecords(row.evidence)?.map(record => record.recordId) ?? [])))];
  const evidence = evidenceIds.length ? await prisma.championAbilityText.findMany({ where: { id: { in: evidenceIds } }, select: { id: true, championId: true, template: true } }) : [];
  const championRows = new Map<number, GlossaryChampionInput>();
  for (const link of links) {
    const row = championRows.get(link.championId) ?? { ...link.champion, abilities: [] };
    row.abilities.push(link);
    championRows.set(link.championId, row);
  }
  const groups = projectGlossaryChampions([...championRows.values()], evidence, effect.id, filters);
  const group = filters.group || (groups.ABILITY.length ? 'ABILITY' : groups.IMMUNITY.length ? 'IMMUNITY' : groups.RESISTANCE.length ? 'RESISTANCE' : 'ABILITY');
  const results = glossaryPage(groups[group], filters.page, 12);
  const texts = results.rows.length ? await prisma.championAbilityText.findMany({ where: { championId: { in: results.rows.map(row => row.id) } }, select: { id: true, championId: true, title: true, group: true, sortOrder: true, template: true } }) : [];
  const synergyChampionIds = results.rows.filter(row => row.applications.some(isSynergyApplication)).map(row => row.id);
  const synergyRows = synergyChampionIds.length ? await prisma.gameSynergy.findMany({
    where: { enabled: true, members: { some: { championId: { in: synergyChampionIds } } } },
    select: { id: true, name: true, description: true, enabled: true, unique: true, requiredHeroGroups: true,
      members: { select: { role: true, rarity: true, champion: { select: { id: true, name: true, shortName: true, class: true, slug: true, images: true } } } } },
  }) : [];
  const rows = results.rows.map(champion => {
    const view = prepareChampionAbilityTextView({ records: texts.filter(text => text.championId === champion.id) });
    const synergyView = buildChampionSynergyView(synergyRows, champion.id, filters.stars ? Number(filters.stars) : null);
    const applications = champion.applications.map(application => {
      // Reuse Kit overview navigation and its canonical synergy header reader, per actual application.
      const original = links.find(link => link.id === application.id)!;
      const synergy = isSynergyApplication(application);
      const target = !synergy ? findChampionKitAbilityTarget(application.ability.name, application.source ?? '', view)
        ?? findChampionKitAbilityTarget(original.ability.name, application.source ?? '', view) : null;
      const kitInput = { ...application, synergyChampions: application.synergyChampions.map(partner => ({ champion: {
        name: partner.champion.name, slug: partner.champion.slug ?? null, images: partner.champion.images, class: partner.champion.class,
      } })) };
      const kitEffect = synergy ? buildChampionKitOverviewEffects([kitInput], new Map())[0] : null;
      const synergySource = kitEffect ? groupChampionKitSources(kitEffect, view, [...synergyView.owned, ...synergyView.incoming])[0]?.synergies[0] : undefined;
      const synergyLink = synergySource?.links[0];
      const requirements = synergySource?.partnerRequirement && synergyLink?.rarities?.length ? {
        ownerStars: synergyLink.rarities, partners: synergySource.partnerRequirement, nonStacking: synergySource.unique === true,
        condition: synergyLink.conditions[0] ?? null,
      } : null;
      const query = new URLSearchParams({ tab: synergy ? 'synergies' : 'abilities' });
      if (filters.stars) query.set('rarity', filters.stars);
      if (target) { query.set('ability', target.recordId); query.set('chapter', target.chapter); }
      if (synergyLink?.synergyId) query.set('synergy', synergyLink.synergyId);
      const anchor = synergyLink?.synergyId ? `#champion-synergy-${encodeURIComponent(synergyLink.synergyId)}` : target ? `#ability-record-${target.recordId}` : '';
      const sourceName = summarizeChampionKitSource(application.source ?? '');
      return { ...application, sourceHref: champion.slug ? `/champions/${champion.slug}?${query}${anchor}` : null,
        sourceLabel: synergy ? 'Synergy requirements' : target ? ['Base kit', 'Conditional'].includes(sourceName) ? 'Read source' : sourceName : 'Full abilities', requirements };
    });
    const synergyInputs = applications.filter(isSynergyApplication).map(application => ({ ...application,
      // A legacy header cannot establish activation requirements. Keep its full condition.
      overviewSummary: application.requirements ? application.overviewSummary : null,
      synergyChampions: application.synergyChampions.map(partner => ({ champion: {
        name: partner.champion.name, slug: partner.champion.slug ?? null, images: partner.champion.images, class: partner.champion.class,
      } })),
    }));
    const synergyEffect = buildChampionKitOverviewEffects(synergyInputs, new Map()).find(item => item.type === group && item.name === effect.name);
    const synergyGroups = synergyEffect ? groupChampionKitSources(synergyEffect, view, [...synergyView.owned, ...synergyView.incoming], { championName: champion.name }) : [];
    return { ...champion, applications, synergySources: synergyEffect && synergyGroups.length ? { effect: synergyEffect, groups: synergyGroups } : null };
  });
  return { effect, filters: { ...filters, group, page: results.page }, counts: { ABILITY: groups.ABILITY.length, IMMUNITY: groups.IMMUNITY.length, RESISTANCE: groups.RESISTANCE.length }, results: { ...results, rows } };
}
export type GlossaryDetail = NonNullable<Awaited<ReturnType<typeof loadGlossaryDetail>>>;
export type GlossaryCatalog = Awaited<ReturnType<typeof loadEffectGlossary>>;
