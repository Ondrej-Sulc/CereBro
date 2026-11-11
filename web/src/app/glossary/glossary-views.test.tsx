// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlossaryCatalogView, GlossaryDetailView } from './glossary-views';
import { normalizeGlossaryFilters } from '@/lib/effect-glossary';
import type { GlossaryDetail } from '@/lib/data/effect-glossary';

const effect = { id: 5, name: 'Bleed', description: 'A recorded Bleed definition.', iconUrl: null, color: '#ffffff', secondaryColor: '#222222', categories: [] };
function documentFor(html: string) { return new DOMParser().parseFromString(html, 'text/html'); }
describe('glossary rendered behavior', () => {
  it('exposes labeled GET filters, deterministic links and recovery from unmatched search', () => {
    const data = { filters: normalizeGlossaryFilters({ q: 'unmatched' }), categories: [], catalogTotal: 883, results: { rows: [], page: 1, pages: 1, total: 0, size: 24 } };
    const doc = documentFor(renderToStaticMarkup(<GlossaryCatalogView data={data} />));
    expect(doc.querySelector('form')?.getAttribute('action')).toBe('/glossary');
    expect(doc.querySelector('input[name=q]')?.getAttribute('value')).toBe('unmatched');
    expect(doc.body.textContent).toContain('No effects found');
    expect(doc.querySelector('a[href="/glossary"]')).not.toBeNull();
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
