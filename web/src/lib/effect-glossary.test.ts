import { describe, expect, it } from 'vitest';
import { glossaryEffectId, glossaryHref, normalizeGlossaryFilters, projectGlossaryChampions } from './effect-glossary';
import { overviewSourceHash } from '../../../src/domain/champion-overview-summary';
import type { ChampionEffectSource } from '../../../src/domain/champion-effects';
import { resistanceEvidenceHash } from '../../../src/domain/champion-resistance-classification';

const champion = { id: 1, name: 'Test Champion', slug: 'test', class: 'SCIENCE', images: {}, obtainable: ['6*', '7-star'], isPlayable: true };
function link(id = 10, extra: Partial<ChampionEffectSource> = {}): ChampionEffectSource {
  return { id, championId: 1, abilityId: 5, ability: { id: 5, name: 'Bleed' }, type: 'ABILITY', source: 'While blocking', effectForm: 'DEBUFF', effectDirection: 'GAIN', synergyChampions: [], ...extra };
}
const project = (links: ChampionEffectSource[], query = {}) => projectGlossaryChampions([{ ...champion, abilities: links }], [], 5, normalizeGlossaryFilters(query));

describe('effect glossary identities and filters', () => {
  it('uses canonical numeric IDs, so normalized and duplicate names never collide', () => {
    expect(glossaryHref(5)).toBe('/glossary/5');
    expect(glossaryHref(6)).toBe('/glossary/6');
    for (const input of ['0', '01', '-1', 'bleed', '1e2', '2147483648', '5/6']) expect(glossaryEffectId(input)).toBeNull();
    expect(glossaryEffectId('5')).toBe(5);
  });
  it('bounds input and clamps invalid filter values', () => {
    expect(normalizeGlossaryFilters({ q: [' a ', 'ignored'], page: '-5', form: 'BUFF', direction: 'GAIN', stars: '8', group: 'bad' })).toMatchObject({ q: 'a', page: 1, form: 'BUFF', direction: 'GAIN', stars: '', group: '' });
  });
  it('accepts only glossary browse return destinations and keeps browse filters separate from champion filters', () => {
    const filters = normalizeGlossaryFilters({ q: 'Gentle', returnTo: '/glossary?category=7&q=bleed&page=2&group=IMMUNITY&returnTo=%2Felsewhere#other' });
    expect(filters).toMatchObject({ q: 'Gentle', returnTo: '/glossary?q=bleed&category=7&page=2#effects-results' });
    for (const returnTo of ['https://example.com/glossary', '//example.com/glossary', '/champions', '/glossary/5', '/glossary/../admin', 'javascript:alert(1)']) {
      expect(normalizeGlossaryFilters({ returnTo }).returnTo).toBe('');
    }
    expect(normalizeGlossaryFilters({}).returnTo).toBe('');
  });
});

describe('public source-bound effect projection', () => {
  it('matches effect/form/direction on the same application without name inference', () => {
    const rows = [link(), link(11, { effectForm: 'BUFF', effectDirection: 'INFLICT' })];
    expect(project(rows, { form: 'DEBUFF', direction: 'INFLICT' }).ABILITY).toHaveLength(0);
    expect(project(rows, { form: 'DEBUFF', direction: 'GAIN' }).ABILITY[0].applications).toHaveLength(1);
  });
  it('keeps multiple actual source applications and required partners distinct', () => {
    const partner = { championId: 2, champion: { name: 'Partner', slug: 'partner' } };
    const rows = project([link(), link(11, { source: 'Synergy: Partner required; while blocking', synergyChampions: [partner] })]).ABILITY;
    expect(rows).toHaveLength(1);
    expect(rows[0].applications.map(source => source.id)).toEqual([10, 11]);
    expect(rows[0].applications[1].synergyChampions).toEqual([partner]);
  });
  it('never promotes conditional immunity or 100% resistance into unconditional immunity', () => {
    const source = link(12);
    const hash = overviewSourceHash({ ...source, name: source.ability.name, synergyChampionIds: [] });
    const result = project([link(10, { type: 'IMMUNITY', source: 'Only while blocking', effectDirection: 'INFLICT' }),
      { ...source, resistances: [{ effectId: 5, effect: { id: 5, name: 'Bleed' }, mechanism: 'DAMAGE', percent: null, sourceHash: hash, evidence: { version: 1, records: [] } }] }]);
    expect(result.IMMUNITY[0].applications[0]).toMatchObject({ source: 'Only while blocking', effectDirection: 'UNKNOWN' });
    expect(result.RESISTANCE[0].applications[0].resistance?.mechanism).toBe('DAMAGE');
  });
  it('rejects stale summary, changed partners and stale resistance evidence', () => {
    const source = link();
    const hash = overviewSourceHash({ ...source, name: source.ability.name, synergyChampionIds: [] });
    const changed = { ...source, source: 'New condition', overviewSummary: { text: 'Old summary', sourceHash: hash }, resistances: [{ effectId: 5, effect: source.ability, mechanism: 'DAMAGE' as const, percent: null, sourceHash: hash, evidence: { version: 1, records: [] } }] };
    const result = project([changed]);
    expect(result.RESISTANCE).toHaveLength(0);
    expect(result.ABILITY[0].applications[0].overviewSummary).toBeNull();
    const bound = { ...source, overviewSummary: { text: 'Valid summary', sourceHash: hash }, resistances: [{ effectId: 5, effect: source.ability, mechanism: 'DAMAGE' as const, percent: 100, sourceHash: hash, evidence: { version: 1, records: [{ recordId: 90, templateHash: resistanceEvidenceHash({ text: '100%' }) }] } }] };
    const inputs = [{ ...champion, abilities: [bound] }];
    const valid = projectGlossaryChampions(inputs, [{ id: 90, championId: 1, template: { text: '100%' } }], 5, normalizeGlossaryFilters({}));
    expect(valid.RESISTANCE[0].applications[0].resistance?.percent).toBe(100);
    expect(valid.IMMUNITY).toHaveLength(0);
    expect(projectGlossaryChampions(inputs, [{ id: 90, championId: 1, template: { text: 'changed' } }], 5, normalizeGlossaryFilters({})).RESISTANCE).toHaveLength(0);
    expect(project([{ ...bound, synergyChampions: [{ championId: 2, champion: { name: 'New partner' } }] }]).ABILITY[0].applications[0].overviewSummary).toBeNull();
  });
  it('uses IDs for effect matching and obtainable rarities for public filtering', () => {
    expect(project([link(10, { abilityId: 6, ability: { id: 6, name: 'Bleed' } })]).ABILITY).toHaveLength(0);
    expect(project([link()], { stars: '5' }).ABILITY).toHaveLength(0);
    expect(project([link()], { stars: '7' }).ABILITY).toHaveLength(1);
    expect(projectGlossaryChampions([{ ...champion, isPlayable: false, abilities: [link()] }], [], 5, normalizeGlossaryFilters({})).ABILITY).toHaveLength(0);
    const synergy = link(20, { source: 'Synergy: Test (6★) with Partner (5★): While blocking', synergyChampions: [{ championId: 2, champion: { name: 'Partner' } }] });
    expect(project([synergy], { stars: '7' }).ABILITY).toHaveLength(0);
    expect(project([synergy], { stars: '6' }).ABILITY).toHaveLength(1);
  });
});
