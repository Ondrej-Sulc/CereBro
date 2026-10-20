import { describe, expect, it } from 'vitest';
import { parseAbilityDisplayFile, planAbilityDisplayUpdates, attachAbilityDisplay, abilityDisplayBindingHash,
  applyAbilityDisplayBindings, parseAbilityDisplayBindings, type AbilityDisplayEntry } from './championAbilityDisplayService';

const entry: AbilityDisplayEntry = { gameId: 'agathaharkness', sourceId: 'base:5', raw: 'Combat text.',
  display: { kind: 'ability', componentId: 'agth_mgclthft_info', section: { id: 'MGCLTHFT', title: 'Magical Theft' } } };
const row = { id: 79137, championId: 814, gameId: entry.gameId, sourceId: entry.sourceId,
  template: { raw: entry.raw, blocks: [{ type: 'paragraph', children: [{ type: 'value', placeholderIndex: 1, source: { rawValue: .01 } }] }] } };

describe('ability display metadata repair', () => {
  it('adds only display metadata to an exact match and is idempotent', () => {
    const original = structuredClone(row);
    const plan = planAbilityDisplayUpdates([row], [entry]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({ id: 79137, before: row.template, after: { ...row.template, display: entry.display } });
    expect(row).toEqual(original);
    expect(planAbilityDisplayUpdates([{ ...row, template: plan.updates[0].after }], [entry])).toMatchObject({ updates: [], unchanged: 1 });
  });
  it('never applies metadata from another source, champion or changed text', () => {
    const plan = planAbilityDisplayUpdates([row, { ...row, id: 2, gameId: 'different' }, { ...row, id: 3, sourceId: 'base:6' },
      { ...row, id: 4, template: { raw: 'Edited combat text.' } }], [entry]);
    expect(plan.updates.map(update => update.id)).toEqual([79137]);
    expect(plan.unmatched).toEqual([2, 3]);
    expect(plan.drifted).toEqual([4]);
    expect(attachAbilityDisplay({ raw: 'Changed text.' }, entry)).toEqual({ raw: 'Changed text.' });
  });
  it('validates display roles and unique source bindings', () => {
    const input = { schemaVersion: 1, provenance: { descriptionsHash: 'a'.repeat(64) }, entries: [entry] };
    expect(parseAbilityDisplayFile(JSON.stringify(input)).entries).toEqual([entry]);
    expect(() => parseAbilityDisplayFile(JSON.stringify({ ...input, entries: [entry, entry] }))).toThrow(/duplicate/i);
    expect(() => parseAbilityDisplayFile(JSON.stringify({ ...input, entries: [{ ...entry, display: { kind: 'invented' } }] }))).toThrow(/display/i);
  });

  it('binds a missing game identity only to the exact explicitly selected source snapshot', () => {
    const missing = { ...row, gameId: null };
    const binding = { championId: row.championId, gameId: entry.gameId, sourceRowsHash: abilityDisplayBindingHash([missing]) };
    const bound = applyAbilityDisplayBindings([missing], [binding]);
    expect(bound).toEqual([row]);
    expect(missing.gameId).toBeNull();
    expect(planAbilityDisplayUpdates(bound, [entry]).updates).toHaveLength(1);
    // Display-only application does not invalidate the original source binding.
    expect(applyAbilityDisplayBindings([{ ...missing, template: { ...missing.template, display: entry.display } }], [binding]))
      .toMatchObject([{ gameId: entry.gameId }]);
    expect(() => applyAbilityDisplayBindings([{ ...missing, sourceId: 'base:other' }], [binding])).toThrow(/snapshot/i);
    expect(() => applyAbilityDisplayBindings([{ ...missing, template: { raw: 'Other text.' } }], [binding])).toThrow(/snapshot/i);
    expect(() => applyAbilityDisplayBindings([row], [binding])).toThrow(/existing game/i);
    expect(() => applyAbilityDisplayBindings([], [binding])).toThrow(/selected/i);
    expect(() => applyAbilityDisplayBindings([missing], [binding, binding])).toThrow(/duplicate/i);
  });

  it('validates missing-identity binding manifests and rejects malformed scopes', () => {
    const binding = { championId: 809, gameId: 'grandmaster_blackorder', sourceRowsHash: 'a'.repeat(64) };
    expect(parseAbilityDisplayBindings(JSON.stringify({ schemaVersion: 1, bindings: [binding] }))).toEqual([binding]);
    for (const bad of [{ ...binding, championId: -1 }, { ...binding, gameId: '' }, { ...binding, sourceRowsHash: 'wrong' }]) {
      expect(() => parseAbilityDisplayBindings(JSON.stringify({ schemaVersion: 1, bindings: [bad] }))).toThrow(/binding/i);
    }
    expect(() => parseAbilityDisplayBindings(JSON.stringify({ schemaVersion: 1, bindings: [binding, binding] }))).toThrow(/duplicate/i);
  });
});
