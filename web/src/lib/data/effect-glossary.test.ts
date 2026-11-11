import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  ability: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  abilityCategory: { findMany: vi.fn() }, championAbilityLink: { findMany: vi.fn() }, championAbilityText: { findMany: vi.fn() },
  gameSynergy: { findMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
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
  it('bounds browse queries and preserves search/category while clamping pages', async () => {
    const data = await loadEffectGlossary({ q: 'Bleed', category: '50', page: '99999' });
    expect(data.results).toMatchObject({ page: 3, pages: 3, total: 50 });
    expect(db.ability.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 24, skip: 48,
      where: expect.objectContaining({ categories: { some: { id: 50 } }, OR: expect.any(Array) }) }));
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
  it('uses Kit synergy matching for exact navigation and correlated rarity requirements', async () => {
    const champion = { id: 1, name: 'Owner', shortName: 'Owner', slug: 'owner', class: 'SCIENCE', images: {}, obtainable: ['6*', '7*'], isPlayable: true };
    const partner = { id: 2, name: 'Partner', shortName: 'Partner', slug: 'partner', class: 'TECH', images: {} };
    db.championAbilityLink.findMany.mockResolvedValue([{ id: 10, championId: 1, abilityId: 5, type: 'IMMUNITY', source: 'Synergy: TEST (6★) with Partner (5★); does not stack: While blocking, gain Bleed immunity.', effectForm: 'UNKNOWN', effectDirection: 'UNKNOWN', ability: effect, champion, overviewSummary: null, synergyChampions: [{ championId: 2, champion: partner }], resistances: [] }]);
    db.gameSynergy.findMany.mockResolvedValue([{ id: 'test-exact', name: 'TEST', description: 'While blocking, gain Bleed immunity.', enabled: true, unique: true, requiredHeroGroups: false, members: [{ role: 'OWNER', rarity: 6, champion }, { role: 'REQUIRED', rarity: 5, champion: partner }] }]);
    const data = await loadGlossaryDetail('5', { group: 'IMMUNITY', stars: '6' });
    const application = data?.results.rows[0].applications[0];
    expect(application?.requirements).toEqual({ ownerStars: [6], partners: 'Partner (5★)', nonStacking: true, condition: 'While blocking, gain Bleed immunity.' });
    expect(application?.sourceHref).toBe('/champions/owner?tab=synergies&rarity=6&synergy=test-exact#champion-synergy-test-exact');
    expect((await loadGlossaryDetail('5', { stars: '7' }))?.counts.IMMUNITY).toBe(0);
  });
});
