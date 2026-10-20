import { describe, expect, it, vi } from 'vitest';
import fixture from '../domain/champion-ability-text/fixtures/game-display-bindings.json';
import { attachAbilityBindings, parseAbilityBindingFile, planAbilityBindingUpdates } from './championAbilityBindingService';
import { buildDescriptionTemplate, importMcocGameDescriptions } from './mcocGameDescriptionsImportService';
import type { PrismaClient } from '@prisma/client';

function metadata() {
  const f = fixture.cases.find(c => c.componentId === 'karrie_sun_sl_loop')!;
  return { schemaVersion: 1, contract: 'GameUtils.GetFormattedLocalizedBuff/v1', provenance: fixture.provenance, held: [],
    entries: [{ gameId: 'arbitrary_champion', sourceId: 'base:1', componentId: f.componentId, hudId: 'hud', bindingComponentIds: [f.componentId], raw: f.raw, sources: f.sources }] };
}
const parsed = () => parseAbilityBindingFile(JSON.stringify(metadata()));
const row = () => ({ id: 1, championId: 2, gameId: 'arbitrary_champion', sourceId: 'base:1',
  template: { ...buildDescriptionTemplate(metadata().entries[0].raw), display: { kind: 'ability' as const, componentId: metadata().entries[0].componentId, hudId: 'hud', section: { id: 'SECTION', title: 'Heading' } } } });

describe('exact source binding repair', () => {
  it('changes only sources, preserving original markup, sections, order, and IDs', () => {
    const before = row();
    const copy = structuredClone(before);
    const plan = planAbilityBindingUpdates([before], parsed().entries);
    expect(plan.updates).toHaveLength(1);
    const after = plan.updates[0].after;
    expect(after.raw).toBe(before.template.raw);
    expect(after.display).toEqual(before.template.display);
    expect(before).toEqual(copy);
    const strip = (v: unknown) => JSON.parse(JSON.stringify(v, (key, value) => key === 'source' ? undefined : value));
    expect(strip(after)).toEqual(strip(before.template));
    expect(planAbilityBindingUpdates([{ ...before, template: after }], parsed().entries)).toMatchObject({ updates: [], held: [], unchanged: 1 });
    // Postgres jsonb does not preserve property insertion order.
    const reorder = (v: any): any => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).reverse().map(([k, val]) => [k, reorder(val)])) : v;
    expect(planAbilityBindingUpdates([{ ...before, template: reorder(after) }], parsed().entries)).toMatchObject({ updates: [], held: [], unchanged: 1 });
  });
  it('refuses raw, identity and source slot drift, without guessing from names', () => {
    const before = row();
    for (const changed of [{ ...before, gameId: 'other' }, { ...before, sourceId: 'base:2' },
      { ...before, template: { ...before.template, raw: 'Different {1} text.' } },
      { ...before, template: { ...before.template, display: { ...before.template.display, hudId: 'other' } } }]) {
      expect(planAbilityBindingUpdates([changed], parsed().entries)).toMatchObject({ updates: [], held: [expect.anything()] });
    }
    expect(() => attachAbilityBindings({ ...before.template, blocks: [] }, parsed().entries[0])).toThrow('coverage');
  });
  it('rejects incomplete, duplicate and mismatched manifest entries', () => {
    for (const mutate of [
      (m: any) => m.entries.push(m.entries[0]),
      (m: any) => delete m.entries[0].sources['2'],
      (m: any) => m.entries[0].sources['1'].gameBinding.slot = 0,
      (m: any) => m.entries[0].sources['1'].rawValue = 999,
      (m: any) => m.entries[0].sources['1'].componentId = 'other',
    ]) {
      const data = structuredClone(metadata()); mutate(data);
      expect(() => parseAbilityBindingFile(JSON.stringify(data))).toThrow();
    }
  });
  it('blocks legacy guessed sources before any importer writes, including the admin service path', async () => {
    const upsert = vi.fn(), transaction = vi.fn();
    const db = { champion: { findMany: async () => [{ id: 2, name: 'Example', shortName: 'Example', gameId: 'arbitrary_champion' }] },
      gameGlossaryTerm: { upsert }, $transaction: transaction } as unknown as PrismaClient;
    await expect(importMcocGameDescriptions(db, { arbitrary_champion: { base_id: 'arbitrary_champion', full_name: 'Example',
      base_abilities: [{ description: 'Gain {1} Buff.' }] } }, {}, { write: true })).rejects.toThrow('Missing verified game display bindings');
    expect(upsert).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
