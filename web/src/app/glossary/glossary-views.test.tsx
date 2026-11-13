// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlossaryCatalogView, GlossaryDetailView } from './glossary-views';
import { normalizeGlossaryFilters } from '@/lib/effect-glossary';
import type { GlossaryDetail } from '@/lib/data/effect-glossary';

const effect = { id: 5, name: 'Bleed', description: 'A recorded Bleed definition.', iconUrl: null, color: '#ffffff', secondaryColor: '#222222', categories: [] };
function documentFor(html: string) { return new DOMParser().parseFromString(html, 'text/html'); }

function sourceCardDetail(): GlossaryDetail {
  const application = { id: 40, championId: 1, type: 'ABILITY' as const, ability: { id: 5, name: 'Indestructible' }, source: 'The complete source has a longer native explanation.', effectForm: 'PASSIVE' as const, effectDirection: 'GAIN' as const, overviewSummary: 'Gain Indestructible while blocking.', synergyChampions: [], sourceHref: '/champions/gentle?tab=abilities&ability=one#ability-record-one', sourceLabel: 'Read source', requirements: null };
  return { effect, filters: { ...normalizeGlossaryFilters({}), group: 'ABILITY' }, counts: { ABILITY: 2, IMMUNITY: 0, RESISTANCE: 0 }, results: { page: 1, pages: 1, total: 2, size: 12, rows: [
    { id: 1, name: 'Gentle', slug: 'gentle', class: 'MUTANT', images: {}, obtainable: ['7*'], stars: [7], synergySources: null, applications: [application] },
    { id: 2, name: 'Heimdall', slug: 'heimdall', class: 'COSMIC', images: {}, obtainable: ['7*'], stars: [7], synergySources: null, applications: [{ ...application, id: 41, championId: 2, sourceHref: '/champions/heimdall?tab=abilities&ability=two#ability-record-two' }] },
  ] } };
}
describe('glossary rendered behavior', () => {
  it('keeps the readable condition and exact source link without repeating the recorded source', () => {
    const doc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={sourceCardDetail()} />));
    expect(doc.body.textContent).not.toContain('Recorded source');
    expect(doc.body.textContent).not.toContain('The complete source has a longer native explanation.');
    expect(doc.querySelector('[data-source-id="40"]')?.textContent).toContain('Gain Indestructible while blocking.');
    expect(doc.querySelector('[data-source-id="40"] a')?.getAttribute('href')).toBe('/champions/gentle?tab=abilities&ability=one#ability-record-one');
    expect(doc.querySelector('[data-source-id="41"] a')?.getAttribute('href')).toBe('/champions/heimdall?tab=abilities&ability=two#ability-record-two');
  });
  it('uses kit source references inline with the form and condition instead of a separate source footer', () => {
    const data = sourceCardDetail();
    const application = data.results.rows[0].applications[0];
    Object.assign(application, { effectForm: 'BUFF', overviewSummary: 'Charging Heavy grants temporary non-stacking Amplify.',
      sourceLabel: 'Charging Heavy', sourceHref: '/champions/gentle?tab=abilities&rarity=7&ability=heavy&chapter=base#ability-record-heavy' });
    const doc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={data}/>));
    const source = doc.querySelector('[data-source-id="40"]')!;
    expect(source.querySelectorAll('a')).toHaveLength(1);
    const paragraph = source.querySelector('p')!;
    expect(paragraph.textContent).toBe('Buff Charging Heavy grants temporary non-stacking Amplify.');
    expect(paragraph.querySelector('a')?.textContent).toBe('Charging Heavy');
    expect(paragraph.querySelector('a')?.getAttribute('href')).toBe(application.sourceHref);
    expect(source.textContent).not.toContain('Gains');
    expect(source.textContent).not.toContain('Read source');
  });
  it('highlights champion portraits with their own class colors independently of the effect color', () => {
    const data = sourceCardDetail();
    data.effect = { ...data.effect, color: '#f97316' };
    const doc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={data} />));
    const portraits = Array.from(doc.querySelectorAll<HTMLElement>('article > div > img'));
    expect(portraits.map(portrait => portrait.style.getPropertyValue('--champion-color'))).toEqual(['#eab308', '#06b6d4']);
    expect(doc.querySelector('a[href="/champions/gentle"]')).not.toBeNull();
    expect(doc.querySelector('a[href="/champions/heimdall"]')).not.toBeNull();
  });
  it('exposes labeled GET filters, deterministic links and recovery from unmatched search', () => {
    const data = { filters: normalizeGlossaryFilters({ q: 'unmatched' }), categories: [], catalogTotal: 883, results: { rows: [], page: 1, pages: 1, total: 0, size: 24 } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryCatalogView data={data} />));
    expect(doc.querySelector('form')?.getAttribute('action')).toBe('/glossary#effects-results');
    expect(doc.querySelector('input[name=q]')?.getAttribute('value')).toBe('unmatched');
    expect(doc.body.textContent).toContain('No effects found');
    expect(doc.querySelector('a[href="/glossary"]')).not.toBeNull();
  });
  it('opens categories ahead of secondary search and keeps the catalog total out of repeated header badges', () => {
    const categories = [
      { id: 7, name: 'Death Counters', description: 'Prevent being knocked out.', _count: { abilities: 6 } },
      { id: 8, name: 'Damage Over Time', description: '', _count: { abilities: 15 } },
    ];
    const data = { filters: normalizeGlossaryFilters({}), categories, catalogTotal: 20, results: { rows: [effect], page: 1, pages: 1, total: 20, size: 24 } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryCatalogView data={data} />));
    const nav = doc.querySelector('nav[aria-label="Effect categories"]');
    expect(nav).not.toBeNull();
    expect(nav!.compareDocumentPosition(doc.querySelector('form')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav?.querySelector('a[href="/glossary?category=7#effects-results"]')?.textContent).toContain('Death counters6');
    expect(nav?.querySelectorAll('a')).toHaveLength(3);
    expect(doc.querySelector('a[aria-current="page"]')?.textContent).toBe('All effects');
    expect(doc.querySelector('details[data-category-picker]')?.hasAttribute('open')).toBe(true);
    expect(doc.querySelector('header')?.textContent).not.toContain('20');
    expect(doc.querySelector('#effects-results h2')?.nextElementSibling?.textContent).toBe('20 effects');
    expect(doc.querySelector('select[name=category]')).toBeNull();
  });
  it('retains the category during search, exposes selection and resets pagination on category changes', () => {
    const categories = [{ id: 7, name: 'Death Counters', description: 'Prevent being knocked out.', _count: { abilities: 6 } }];
    const filters = normalizeGlossaryFilters({ category: '7', q: 'death', page: '2' });
    const data = { filters, categories, catalogTotal: 883, results: { rows: [effect], page: 2, pages: 3, total: 50, size: 24 } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryCatalogView data={data} />));
    const form = doc.querySelector('form[role=search]')!;
    const fields = new FormData(form as HTMLFormElement);
    expect(fields.get('category')).toBe('7');
    expect(fields.get('q')).toBe('death');
    expect(fields.has('page')).toBe(false);
    expect(doc.querySelector('nav[aria-label="Effect categories"] a[aria-current=page]')?.getAttribute('href')).toBe('/glossary?q=death&category=7#effects-results');
    expect(doc.querySelector('a[rel=next]')?.getAttribute('href')).toBe('/glossary?q=death&category=7&page=3');
    expect(doc.querySelector('a[href="/glossary?category=7#effects-results"]')?.textContent).toContain('Clear search');
    const picker = doc.querySelector('details[data-category-picker]');
    expect(picker?.hasAttribute('open')).toBe(false);
    expect(picker?.querySelector('summary')?.textContent).toBe('Death counters6 effects');
    expect(doc.querySelector('#effects-results h2')?.textContent).toBe('Effects');
    expect(doc.querySelector('#effects-results h2')?.nextElementSibling?.textContent).toBe('50 effects matching “death”');
  });
  it('keeps category context and recovery links for unknown or empty results', () => {
    const filters = normalizeGlossaryFilters({ category: '999', q: 'missing' });
    const data = { filters, categories: [], catalogTotal: 883, results: { rows: [], page: 1, pages: 1, total: 0, size: 24 } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryCatalogView data={data} />));
    expect(doc.querySelector('input[type=hidden][name=category]')?.getAttribute('value')).toBe('999');
    expect(doc.querySelector('#effects-results h2')?.textContent).toBe('Unknown category');
    expect(doc.body.textContent).toContain('No effects found');
    expect(doc.querySelector('a[href="/glossary"]')).not.toBeNull();
    expect(doc.querySelector('details[data-category-picker]')?.hasAttribute('open')).toBe(true);
  });
  it('pairs related categories, separates scope labels, and retains unknown categories and exact links', () => {
    const categories = [
      { id: 4, name: 'Power Control (Self)', description: '', _count: { abilities: 15 } },
      { id: 3, name: 'Power Control (Opponent)', description: '', _count: { abilities: 24 } },
      { id: 2, name: 'Damage Over Time (DoT)', description: '', _count: { abilities: 27 } },
      { id: 99, name: 'New category', description: '', _count: { abilities: 1 } },
    ];
    const original = structuredClone(categories);
    const data = { filters: normalizeGlossaryFilters({}), categories, catalogTotal: 883, results: { rows: [effect], page: 1, pages: 1, total: 883, size: 24 } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryCatalogView data={data}/>));
    const choices = Array.from(doc.querySelectorAll('nav[aria-label="Effect categories"] a'));
    expect(choices.map(choice => choice.getAttribute('href'))).toEqual([
      '/glossary#effects-results', '/glossary?category=2#effects-results', '/glossary?category=3#effects-results', '/glossary?category=4#effects-results', '/glossary?category=99#effects-results',
    ]);
    expect(choices[2].textContent).toBe('Power controlOpponent24');
    expect(choices[3].textContent).toBe('Power controlSelf15');
    expect(choices[2].getAttribute('aria-label')).toBe('Power Control (Opponent), 24 effects');
    expect(choices[4].textContent).toBe('New category1');
    expect(categories).toEqual(original);
  });
  it('shows conditional protection and required partners with distinct source identities', () => {
    const application = { id: 10, championId: 1, type: 'IMMUNITY' as const, ability: { id: 5, name: 'Bleed' }, source: 'Synergy: Only while blocking with Partner (6★).', effectForm: 'UNKNOWN' as const, effectDirection: 'UNKNOWN' as const, overviewSummary: 'Short copy omitting requirements', synergyChampions: [{ championId: 2, champion: { name: 'Partner', slug: 'partner' } }], sourceHref: '/champions/test?tab=synergies', sourceLabel: 'Synergy requirements', requirements: null };
    const data: GlossaryDetail = { effect, filters: { ...normalizeGlossaryFilters({ group: 'IMMUNITY' }), group: 'IMMUNITY' }, counts: { ABILITY: 0, IMMUNITY: 1, RESISTANCE: 0 }, results: { page: 1, pages: 1, total: 1, size: 12, rows: [{ id: 1, name: 'Test Champion', slug: 'test', class: 'SCIENCE', images: {}, obtainable: ['7*'], stars: [7], synergySources: null, applications: [application, { ...application, id: 11, source: 'While charging Heavy' }] }] } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={data} />));
    expect(doc.querySelector('[data-source-id="10"]')?.textContent).toContain('Only while blocking with Partner (6★).');
    expect(doc.querySelector('[data-source-id="11"]')).not.toBeNull();
    expect(doc.querySelector('a[href="/champions/partner"]')).not.toBeNull();
    expect(doc.querySelector('a[href="/champions/test?tab=synergies"]')).not.toBeNull();
    expect(doc.querySelector('nav[aria-label="Champion effect groups"] [aria-current="page"]')?.textContent).toBe('Immune1');
    expect(doc.querySelector('select[name=direction]')).toBeNull();
    const identity = doc.querySelector('article > div');
    expect(identity?.textContent).not.toContain('7★');
    expect(identity?.querySelector('[aria-label^="Obtainable at"]')).toBeNull();
    const advanced = doc.querySelector('form[aria-label="Find champions"] details');
    expect(advanced?.hasAttribute('open')).toBe(false);
    expect(advanced?.querySelector('select[name=stars]')).not.toBeNull();
    expect(doc.querySelector('form[aria-label="Find champions"]')?.getAttribute('method')).toBe('get');
    const caveat = Array.from(doc.querySelectorAll('details')).find(detail => detail.textContent?.includes('Immunity can be conditional'));
    expect(caveat?.hasAttribute('open')).toBe(false);
    expect(advanced?.querySelector('button[type=submit]')?.textContent).toContain('Apply filters');
    const scoped: GlossaryDetail = { ...data, filters: { ...data.filters, group: 'ABILITY', q: 'Test', stars: '7', championClass: 'SCIENCE', form: 'DEBUFF', direction: 'INFLICT' } };
    const scopeDoc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={scoped} />));
    expect(scopeDoc.querySelector('[aria-label="Active champion filters"]')?.textContent).toBe('“Test”Science7★DebuffInflictsReset');
    expect(scopeDoc.querySelector('select[name=form] option[value=DEBUFF]')?.hasAttribute('selected')).toBe(true);
    expect(scopeDoc.querySelector('a[href="/glossary/5?group=ABILITY"]')).not.toBeNull();
    expect(scopeDoc.querySelector('details select[name=direction]')).not.toBeNull();
    expect(scopeDoc.querySelector('article > div')?.textContent).not.toContain('7★');
    expect(scopeDoc.querySelector('a[href="/champions/test?rarity=7"]')).not.toBeNull();
    const withRequirements: GlossaryDetail = { ...data, results: { ...data.results, rows: [{ ...data.results.rows[0], applications: [{ ...application, requirements: { ownerStars: [6, 7], partners: 'Partner (5★) OR Other (6★/7★)', nonStacking: true, condition: 'While blocking.' } }] }] } };
    const requirementsDoc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={withRequirements} />));
    const source = requirementsDoc.querySelector('[data-source-id="10"]');
    expect(source?.textContent).toContain('Requires this champion at 6★/7★ with:Partner (5★) OR Other (6★/7★)');
    expect(source?.querySelector('a[href="/champions/partner"]')).not.toBeNull();
    expect(requirementsDoc.querySelector('article > div')?.textContent).not.toContain('7★');
    const protectionDoc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={{ ...data, filters: { ...scoped.filters, group: 'IMMUNITY' } }} />));
    expect(protectionDoc.querySelector('input[type=hidden][name=form]')?.getAttribute('value')).toBe('DEBUFF');
    expect(protectionDoc.querySelector('[aria-label="Active champion filters"]')?.textContent).toContain('Effect: DebuffEffect: Inflicts');
  });
  it('uses the shared kit synergy display with partner portraits and grouped level links', () => {
    const condition = 'This non-stacking synergy grants temporary Vigilance on Well-Timed Blocks.';
    const partner = { name: 'Patriot', slug: 'patriot', images: {} };
    const application = { id: 10, championId: 1, type: 'ABILITY' as const, ability: { id: 5, name: 'Vigilance' }, source: 'Synergy: TEAMWORK', effectForm: 'PASSIVE' as const, effectDirection: 'GAIN' as const, overviewSummary: null, synergyChampions: [{ championId: 2, champion: partner }], sourceHref: '/champions/sam?tab=synergies', sourceLabel: 'Synergy requirements', requirements: null };
    const data: GlossaryDetail = { effect: { ...effect, name: 'Vigilance' }, filters: { ...normalizeGlossaryFilters({}), group: 'ABILITY' }, counts: { ABILITY: 1, IMMUNITY: 0, RESISTANCE: 0 }, results: { page: 1, pages: 1, total: 1, size: 12, rows: [{ id: 1, name: 'Captain America (Sam Wilson)', slug: 'sam', class: 'TECH', images: {}, obtainable: ['7*'], stars: [7], applications: [application, { ...application, id: 11 }], synergySources: {
      effect: { name: 'Vigilance', type: 'ABILITY', iconUrl: null, color: '#fff', secondaryColor: '#000', description: null, sources: [] },
      groups: [{ key: 'PASSIVE:GAIN', effectForm: 'PASSIVE', effectDirection: 'GAIN', nativeSources: [], synergies: [1, 2].map(level => ({ key: `teamwork-${level}`, champions: [partner], unique: true, partnerRarities: [level + 4], partnerRequirement: `Patriot (${level + 4}\u2605)`, links: [{ key: `teamwork-${level}`, label: `Teamwork - Lv. ${level}`, synergyId: `teamwork-${level}`, rarities: [6, 7], conditions: [condition] }] })) }],
    } }] } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryDetailView data={data}/>));
    const shared = doc.querySelector('[data-effect-sources]');
    expect(shared).not.toBeNull();
    expect(shared?.textContent?.split(condition)).toHaveLength(2);
    expect(shared?.querySelector('a[href="/champions/patriot"] img')).not.toBeNull();
    const badge = shared?.querySelector('[data-synergy-badge]');
    expect(badge?.textContent).toBe('Synergy');
    expect(badge?.querySelector('a')?.getAttribute('aria-label')).toBe('View Patriot');
    for (const level of [1, 2]) expect(shared?.querySelector(`a[href="/champions/sam?tab=synergies#champion-synergy-teamwork-${level}"]`)?.textContent).toBe(`Lv. ${level}`);
    expect(shared?.textContent).not.toContain('\u2605');
    expect(doc.body.textContent).not.toContain('Requires this champion');
    expect(doc.body.textContent).toContain('2 sources');
  });
  it('uses the bound effect palette for identity without changing category meaning or controls', () => {
    const colored = { ...effect, color: '#f71817', secondaryColor: '#fbc6c6', categories: [{ id: 50, name: 'Damage Over Time', description: 'Recorded category' }] };
    const data = { filters: normalizeGlossaryFilters({}), categories: [], catalogTotal: 1, results: { rows: [colored], page: 1, pages: 1, total: 1, size: 24 } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryCatalogView data={data} />));
    const card = doc.querySelector('a[href="/glossary/5"]');
    expect(card?.getAttribute('style')).toContain('--effect-color:#f71817');
    expect(card?.getAttribute('style')).toContain('--effect-secondary:#fbc6c6');
    expect(card?.textContent).toContain('Damage Over Time');
    expect(card?.textContent).toContain('Bleed');
  });
});
