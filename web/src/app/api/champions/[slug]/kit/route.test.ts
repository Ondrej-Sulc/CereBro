import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const db = vi.hoisted(() => ({ champion: { findUnique: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/with-request-context', () => ({ withRouteContext: (handler: unknown) => handler }));
vi.mock('@/lib/data/champion-synergies', () => ({ getChampionSynergies: async () => [] }));
vi.mock('@/lib/data/champion-resistances', () => ({ getResistanceIndex: async () => [], attachResistances: (entries: unknown) => entries }));
const text = 'Incoming Bleed effects suffer -90% duration.';
const entry = { id: 1, championId: 487, abilityId: 1, type: 'ABILITY', source: 'Signature: incoming Bleed effects have reduced duration.',
  ability: { name: 'Damage Reduction', categories: [] }, effectForm: 'UNKNOWN', effectDirection: 'GAIN', synergyChampions: [],
  overviewSummary: null, resistances: [{ effect: { name: 'Bleed', categories: [] }, mechanism: 'DURATION', percent: null,
    valueRecords: [{ id: 1, group: 'signature', title: null, template: { raw: text } }] }] };
beforeEach(() => db.champion.findUnique.mockResolvedValue({ id: 487, name: 'Ant-Man (Future)', shortName: 'Ant-Man', gameId: 'antman_future',
  abilities: [entry], abilityTexts: [], abilityCurves: [], stats: [] }));
const request = (query: string) => GET(new NextRequest(`http://localhost/api/champions/ant-man-future/kit${query}`), { params: Promise.resolve({ slug: 'ant-man-future' }) });

describe('kit build context', () => {
  it('uses the requested signature, marks catalog defaults as previews, and leaves sources intact', async () => {
    for (const [query, label] of [['?rarity=7&sig=1&rank=4', 'Sig 1'], ['?rarity=7', 'Sig 200 preview'], ['?rarity=7&sig=0', 'Unawakened']]) {
      const response = await request(query);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values[0].label).toBe(label);
      expect(body.entries[0].source).toBe(entry.source);
      expect(body.entries[0].resistances[0].valueRecords).toBeUndefined();
    }
    expect(db.champion.findUnique.mock.calls[0][0].select.stats.where).toEqual({ rarity: 7, rank: 4 });
  });
  it.each(['?sig=201', '?sig=-1', '?sig=', '?sig=abc', '?rarity=4&sig=200', '?rarity=7&sig=1.5', '?rank=2', '?rarity=7&rank=0'])('rejects an invalid build: %s', async query => {
    const response = await request(query);
    expect(response.status).toBe(400);
  });
});
