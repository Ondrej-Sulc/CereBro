import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  ability: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  abilityCategory: { findMany: vi.fn() }, championAbilityLink: { findMany: vi.fn() }, championAbilityText: { findMany: vi.fn() },
  gameSynergy: { findMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
import { overviewSourceHash } from '@cerebro/core/domain/champion-overview-summary';
import { groupSynergySourceDisplay } from '@cerebro/core/domain/champion-kit-source-display';
import { getGlossaryEffect, loadEffectGlossary, loadGlossaryDetail } from './effect-glossary';
const effect = { id: 5, name: 'Bleed', description: 'Recorded definition.', iconUrl: null, gameGlossaryTermId: null, gameGlossaryTerm: null, categories: [] };
beforeEach(() => {
  vi.resetAllMocks();
  db.ability.findUnique.mockResolvedValue(effect);
  db.ability.count.mockResolvedValue(50);
  db.ability.findMany.mockResolvedValue([effect]);
  db.abilityCategory.findMany.mockResolvedValue([]);
  db.championAbilityLink.findMany.mockResolvedValue([]);
  db.championAbilityText.findMany.mockResolvedValue([]);
  db.gameSynergy.findMany.mockResolvedValue([]);
});
describe('glossary read boundaries', () => {
  it('rejects invalid IDs without database reads and returns missing effects', async () => {
    expect(await getGlossaryEffect('bleed')).toBeNull();
    expect(db.ability.findUnique).not.toHaveBeenCalled();
    db.ability.findUnique.mockResolvedValue(null);
    expect(await loadGlossaryDetail('999', {})).toBeNull();
    expect(db.championAbilityLink.findMany).not.toHaveBeenCalled();
  });
  it('keeps the full category suggestion set beyond pagination while clamping ranked search results', async () => {
    const category = { id: 50, name: 'Damage Over Time', description: 'Public category description.' };
    const effects = Array.from({ length: 52 }, (_, index) => ({ ...effect, id: index + 1, name: `Bleed ${String(index + 1).padStart(2, '0')}`, categories: [category] }));
    db.ability.findMany.mockResolvedValue([...effects, { ...effect, id: 99, name: 'Bleed outside category' }]);
    db.abilityCategory.findMany.mockResolvedValue([{ ...category, _count: { abilities: 52 } }]);
    const data = await loadEffectGlossary({ q: 'blee', category: '50', page: '99999' });
    expect(data.results).toMatchObject({ page: 3, pages: 3, total: 52, size: 24 });
    expect(data.results.rows.map(row => row.id)).toEqual([49, 50, 51, 52]);
    expect(data.filters).toMatchObject({ q: 'blee', category: 50, page: 3 });
    expect(data.searchOptions.map(option => option.id)).toEqual(effects.map(row => row.id));
    expect(data.searchOptions.some(option => option.id === 99)).toBe(false);
    expect(data.catalogTotal).toBe(53);
    expect(data.categories).toEqual([{ ...category, _count: { abilities: 52 } }]);
  });
  it('sends only public effect lookup fields and excludes native raw and category metadata', async () => {
    db.ability.findMany.mockResolvedValue([{ ...effect, categories: [{ id: 50, name: 'Damage Over Time', description: 'Category prose.' }],
      gameGlossaryTermId: 'native-bleed', gameGlossaryTerm: { description: 'Full native definition.', iconUrl: '/bleed.svg', raw: { color_primary: 'f71817', privateTestMarker: 'must-not-project' } } }]);
    const data = await loadEffectGlossary({ q: 'bleed' });
    expect(data.searchOptions).toHaveLength(1);
    const option = data.searchOptions[0];
    expect(option).toMatchObject({ id: 5, name: 'Bleed', description: 'Recorded definition.', iconUrl: '/bleed.svg', color: '#f71817', categories: [{ id: 50, name: 'Damage Over Time' }] });
    expect(Object.keys(option).sort()).toEqual(['categories', 'color', 'description', 'iconUrl', 'id', 'name', 'searchText', 'secondaryColor']);
    expect(JSON.stringify(option)).not.toMatch(/must-not-project|gameGlossaryTerm|Category prose/);
  });
  it('retains searches of displayed and bound native definitions with the same matching as suggestions', async () => {
    db.ability.findMany.mockResolvedValue([
      { ...effect, id: 5, name: 'Protected', description: 'A short reviewed summary.', gameGlossaryTerm: { description: 'Heavy attacks prevent regeneration.', iconUrl: null, raw: {} } },
      { ...effect, id: 6, name: 'Separate', description: 'Unrelated words.' },
    ]);
    const native = await loadEffectGlossary({ q: 'regeneration heavy' });
    expect(native.results.rows.map(row => row.id)).toEqual([5]);
    expect(native.results.rows[0].description).toBe('A short reviewed summary.');
    const reviewed = await loadEffectGlossary({ q: 'reviewed summary' });
    expect(reviewed.results.rows.map(row => row.id)).toEqual([5]);
    const empty = await loadEffectGlossary({ q: 'no-such-definition' });
    expect(empty.results.rows).toEqual([]);
    expect(empty.searchOptions).toHaveLength(2);
    const unknownCategory = await loadEffectGlossary({ category: '999' });
    expect(unknownCategory.searchOptions).toEqual([]);
    expect(unknownCategory.results.total).toBe(0);
  });
  it('avoids duplicating the displayed definition in suggestion search data and keeps blank browsing alphabetical', async () => {
    db.ability.findMany.mockResolvedValue([
      { ...effect, id: 7, name: 'Poison', description: null, gameGlossaryTerm: { description: '  Native definition.  ', iconUrl: null, raw: {} } },
      { ...effect, id: 5, name: 'Bleed', gameGlossaryTerm: { description: effect.description, iconUrl: null, raw: {} } },
    ]);
    const data = await loadEffectGlossary({ q: '   ' });
    expect(data.results.rows.map(row => row.name)).toEqual(['Bleed', 'Poison']);
    expect(data.searchOptions.map(option => option.description)).toEqual(['Recorded definition.', 'Native definition.']);
    expect(data.searchOptions.every(option => !Object.hasOwn(option, 'searchText'))).toBe(true);
  });
  it('restricts details to the exact effect and public champion sources', async () => {
    const data = await loadGlossaryDetail('5', {});
    expect(data?.counts).toEqual({ ABILITY: 0, IMMUNITY: 0, RESISTANCE: 0 });
    expect(db.championAbilityLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      champion: { isPlayable: true }, OR: [{ abilityId: 5 }, { resistances: { some: { effectId: 5 } } }],
    } }));
    expect(db.championAbilityText.findMany).not.toHaveBeenCalled();
  });
  it('uses only the explicitly bound imported palette, retaining neutral fallback for absent colors', async () => {
    db.ability.findMany.mockResolvedValue([{ ...effect, gameGlossaryTerm: { description: null, iconUrl: '/bleed.svg', raw: { color_primary: 'f71817', color_secondary: 'fbc6c6' } } },
      { ...effect, id: 6, name: 'Poison', gameGlossaryTerm: null }]);
    const data = await loadEffectGlossary({});
    expect(data.results.rows[0]).toMatchObject({ color: '#f71817', secondaryColor: '#fbc6c6', iconUrl: '/bleed.svg' });
    expect(data.results.rows[1]).toMatchObject({ color: '#b8c5d6', secondaryColor: '#263142', iconUrl: null });
  });
  it('counts unique filtered champions, retains application identities and loads only visible text', async () => {
    const champion = (id: number) => ({ id, name: `Champion ${String(id).padStart(2, '0')}`, slug: `champion-${id}`, class: 'SCIENCE', images: {}, obtainable: ['7*'], isPlayable: true });
    const source = (id: number, championId: number) => ({ id, championId, abilityId: 5, type: 'ABILITY', source: 'While blocking', effectForm: 'DEBUFF', effectDirection: 'GAIN', ability: effect, champion: champion(championId), overviewSummary: null, synergyChampions: [], resistances: [] });
    db.championAbilityLink.findMany.mockResolvedValue([...Array.from({ length: 13 }, (_, index) => source(index + 1, index + 1)), source(14, 1)]);
    const data = await loadGlossaryDetail('5', { page: '2' });
    expect(data?.counts.ABILITY).toBe(13);
    expect(data?.results.rows.map(row => row.id)).toEqual([13]);
    expect(db.championAbilityText.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { championId: { in: [13] } } }));
    expect(data?.results.rows[0].applications[0].sourceHref).toBe('/champions/champion-13?tab=abilities');
    const first = await loadGlossaryDetail('5', { q: 'Champion 01' });
    expect(first?.counts.ABILITY).toBe(1);
    expect(first?.results.rows[0].applications.map(row => row.id)).toEqual([1, 14]);
  });
  it('groups equivalent synergy variants across applications while retaining every original card link', async () => {
    const champion = { id: 1, name: 'Owner', shortName: 'Owner', slug: 'owner', class: 'SCIENCE', images: {}, obtainable: ['7*'], isPlayable: true };
    const partner = { id: 2, name: 'Partner', shortName: 'Partner', slug: 'partner', class: 'TECH', images: {} };
    const condition = 'While blocking, gain Bleed immunity.';
    db.championAbilityLink.findMany.mockResolvedValue([1, 2].map(level => ({ id: level, championId: 1, abilityId: 5, type: 'IMMUNITY', source: `Synergy: TEST - Lv. ${level} (7\u2605) with Partner (${level + 4}\u2605); does not stack: ${condition}`, effectForm: 'UNKNOWN', effectDirection: 'UNKNOWN', ability: effect, champion, overviewSummary: null, synergyChampions: [{ championId: 2, champion: partner }], resistances: [] })));
    db.gameSynergy.findMany.mockResolvedValue([1, 2].map(level => ({ id: `test-${level}`, name: `TEST - Lv. ${level}`, description: condition, enabled: true, unique: true, requiredHeroGroups: false, members: [{ role: 'OWNER', rarity: 7, champion }, { role: 'REQUIRED', rarity: level + 4, champion: partner }] })));
    const data = await loadGlossaryDetail('5', { group: 'IMMUNITY' });
    const row = data!.results.rows[0];
    expect(row.applications.map(application => application.id)).toEqual([1, 2]);
    const display = groupSynergySourceDisplay(row.synergySources!.groups[0].synergies);
    expect(display).toHaveLength(1);
    expect(display[0].conditions).toEqual([condition]);
    expect(display[0].references.map(reference => reference.synergyId)).toEqual(['test-1', 'test-2']);
    expect(display[0].references.map(reference => reference.partnerRarities)).toEqual([[5], [6]]);
    expect(display[0].champions[0].class).toBe('TECH');
    expect(db.championAbilityLink.findMany.mock.calls[0][0].include.synergyChampions.include.champion.select.class).toBe(true);
  });
  it('retains a legacy synergy condition when a shorter summary omits its activation requirements', async () => {
    const champion = { id: 1, name: 'Owner', slug: 'owner', class: 'SCIENCE', images: {}, obtainable: ['7*'], isPlayable: true };
    const source = { id: 10, championId: 1, abilityId: 5, name: 'Bleed', type: 'IMMUNITY' as const, source: 'Synergy: Only while blocking with Partner (6\u2605).', effectForm: 'UNKNOWN' as const, effectDirection: 'UNKNOWN' as const, synergyChampionIds: [2] };
    db.championAbilityLink.findMany.mockResolvedValue([{ ...source, ability: effect, champion, overviewSummary: { text: 'Short copy omitting requirements', sourceHash: overviewSourceHash(source) }, synergyChampions: [{ championId: 2, champion: { name: 'Partner', slug: 'partner', images: {} } }], resistances: [] }]);
    const data = await loadGlossaryDetail('5', { group: 'IMMUNITY' });
    const row = data!.results.rows[0];
    expect(row.applications[0].overviewSummary).toBe('Short copy omitting requirements');
    expect(row.synergySources!.groups[0].synergies[0].links[0].conditions).toEqual([source.source]);
  });
  it('uses Kit synergy matching for exact navigation and correlated rarity requirements', async () => {
    const champion = { id: 1, name: 'Owner', shortName: 'Owner', slug: 'owner', class: 'SCIENCE', images: {}, obtainable: ['6*', '7*'], isPlayable: true };
    const partner = { id: 2, name: 'Partner', shortName: 'Partner', slug: 'partner', class: 'TECH', images: {} };
    db.championAbilityLink.findMany.mockResolvedValue([{ id: 10, championId: 1, abilityId: 5, type: 'IMMUNITY', source: 'Synergy: TEST (6★) with Partner (5★); does not stack: While blocking, gain Bleed immunity.', effectForm: 'UNKNOWN', effectDirection: 'UNKNOWN', ability: effect, champion, overviewSummary: null, synergyChampions: [{ championId: 2, champion: partner }], resistances: [] }]);
    db.gameSynergy.findMany.mockResolvedValue([{ id: 'test-exact', name: 'TEST', description: 'While blocking, gain Bleed immunity.', enabled: true, unique: true, requiredHeroGroups: false, members: [{ role: 'OWNER', rarity: 6, champion }, { role: 'REQUIRED', rarity: 5, champion: partner }] }]);
    const data = await loadGlossaryDetail('5', { group: 'IMMUNITY', stars: '6' });
    const application = data?.results.rows[0].applications[0];
    expect(application?.requirements).toEqual({ ownerStars: [6], partners: 'Partner (5★)', nonStacking: true, condition: 'While blocking, gain Bleed immunity.' });
    expect(application?.sourceHref).toBe('/champions/owner?tab=synergies&rarity=6&synergy=test-exact#champion-synergy-test-exact');
    const shared = data?.results.rows[0].synergySources;
    expect(shared?.effect).toMatchObject({ name: 'Bleed', type: 'IMMUNITY' });
    expect(shared?.groups[0].synergies[0]).toMatchObject({ champions: [{ name: 'Partner', slug: 'partner' }], partnerRarities: [5], unique: true, links: [{ synergyId: 'test-exact', rarities: [6], conditions: ['While blocking, gain Bleed immunity.'] }] });
    expect((await loadGlossaryDetail('5', { stars: '7' }))?.counts.IMMUNITY).toBe(0);
  });
});
