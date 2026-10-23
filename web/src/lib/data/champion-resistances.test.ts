import { beforeEach, describe, expect, it, vi } from 'vitest';
import { overviewSourceHash } from '@cerebro/core/domain/champion-overview-summary';
import { resistanceEvidenceHash } from '@cerebro/core/domain/champion-resistance-classification';
import { prisma } from '@/lib/prisma';
import { attachResistances, getResistanceIndex } from './champion-resistances';
vi.mock('@/lib/prisma', () => ({ prisma: { championAbilityResistance: { findMany: vi.fn() }, championAbilityText: { findMany: vi.fn() } } }));
const template = { raw: 'Incoming Bleed potency is reduced.' };
const textRecord = { id: 5, championId: 2, sourceId: 'base:1', group: 'base', title: null, sortOrder: 1, template };
const link = { id: 1, championId: 2, abilityId: 3, type: 'ABILITY' as const, source: 'Incoming Bleed potency is reduced by 150%.',
  effectForm: 'UNKNOWN' as const, effectDirection: 'GAIN' as const, ability: { name: 'Damage Reduction' }, synergyChampions: [] };
const row = { championAbilityLinkId: 1, effectId: 4, mechanism: 'POTENCY' as const, percent: 150,
  sourceHash: overviewSourceHash({ ...link, name: link.ability.name, synergyChampionIds: [] }),
  evidence: { version: 1, records: [{ recordId: 5, templateHash: resistanceEvidenceHash(template) }] },
  effect: { name: 'Bleed', description: null, iconUrl: null, gameGlossaryTermId: null, gameGlossaryTerm: null, categories: [] },
  championAbilityLink: link };
beforeEach(() => {
  vi.mocked(prisma.championAbilityResistance.findMany).mockResolvedValue([row]);
  vi.mocked(prisma.championAbilityText.findMany).mockResolvedValue([textRecord]);
});
describe('current resistance bindings', () => {
  it('publishes only classifications bound to the current source and imported evidence', async () => {
    const index = await getResistanceIndex();
    expect(attachResistances([link], index)[0].resistances).toEqual([{ effect: row.effect, mechanism: 'POTENCY', percent: 150 }]);
    expect(attachResistances([{ ...link, source: 'Changed source' }], index)[0].resistances).toEqual([]);
    expect(attachResistances([{ ...link, synergyChampions: [{ champion: { name: 'New required partner' } }] }], index)[0].resistances).toEqual([]);
  });
  it('rejects changed imported numeric evidence', async () => {
    vi.mocked(prisma.championAbilityText.findMany).mockResolvedValue([{ ...textRecord, template: { raw: 'Changed' } }]);
    expect(await getResistanceIndex()).toEqual([]);
  });
  it('attaches fresh numeric templates only for champion-specific contextual reads', async () => {
    vi.mocked(prisma.championAbilityResistance.findMany).mockResolvedValue([{ ...row, percent: null }]);
    const native = await getResistanceIndex(2);
    expect(native[0].valueRecords).toEqual([{ id: 5, group: 'base', title: null, sortOrder: 1, template }]);
    expect((await getResistanceIndex())[0].valueRecords).toBeUndefined();
    vi.mocked(prisma.championAbilityText.findMany).mockResolvedValue([{ ...textRecord, template: { raw: 'Changed' } }]);
    expect(await getResistanceIndex(2)).toEqual([]);
  });
  it('rejects a changed source or an unbound fixed percentage', async () => {
    const changed = [{ ...row, championAbilityLink: { ...link, effectDirection: 'INFLICT' } }];
    vi.mocked(prisma.championAbilityResistance.findMany).mockResolvedValue(changed);
    expect(await getResistanceIndex()).toEqual([]);
    vi.mocked(prisma.championAbilityResistance.findMany).mockResolvedValue([{ ...row, evidence: { version: 1, records: [] } }]);
    expect(await getResistanceIndex()).toEqual([]);
  });
});
