import { describe, expect, it } from 'vitest';
import { classifyResistanceSource, fixedResistancePercent, resistanceEvidenceHash } from './champion-resistance-classification';
const base = { type: 'ABILITY', effectDirection: 'GAIN', name: 'Damage Reduction' };
const binding = (growth?: object) => ({ blocks: [{ children: [{ type: 'value', source: { gameBinding: {
  version: 1, slot: 1, value: -1.5, formula: { id: 'x100', type: 'mod_x_vara', a: 100, b: 0, c: 0 }, ...(growth ? { growth } : {}),
} } }] }] });
describe('resistance classification from explicit sources', () => {
  it('binds dates and uses stable key order across JSON round trips', () => {
    const value = { child: 1, createdAt: new Date('2026-10-22T00:00:00Z'), chance: 2 };
    expect(resistanceEvidenceHash(value)).toBe(resistanceEvidenceHash(JSON.parse(JSON.stringify(value))));
    expect(resistanceEvidenceHash(value)).not.toBe(resistanceEvidenceHash({ ...value, createdAt: new Date('2026-10-23T00:00:00Z') }));
  });
  it('classifies incoming effect protection and preserves separate mechanisms', () => {
    expect(classifyResistanceSource({ ...base, source: 'Incoming Bleed potency is reduced by 150%; Bleed still applies.' })).toEqual([{ target: 'Bleed', mechanism: 'POTENCY' }]);
    expect(classifyResistanceSource({ ...base, name: 'Bleed Resistance', source: 'Incoming Bleed effects: 65% decreased potency and duration' })).toEqual([{ target: 'Bleed', mechanism: 'POTENCY_AND_DURATION' }]);
    expect(classifyResistanceSource({ ...base, source: 'Take 100% less damage from Incinerate Debuffs.' })).toEqual([{ target: 'Incinerate', mechanism: 'DAMAGE' }]);
  });
  it('does not infer resistance from outgoing reductions, true immunity or general hit mitigation', () => {
    expect(classifyResistanceSource({ ...base, type: 'IMMUNITY', name: 'Bleed', source: 'Immune to Bleed.' })).toEqual([]);
    expect(classifyResistanceSource({ ...base, effectDirection: 'INFLICT', name: 'Stun Duration Reduction', source: 'Opponent Stuns have reduced duration.' })).toEqual([]);
    expect(classifyResistanceSource({ ...base, source: 'While suffering Bleed, reduce incoming hit damage by 50%.' })).toEqual([]);
  });
  it('keeps a later expiry condition from changing the protection mechanism', () => {
    expect(classifyResistanceSource({ ...base, name: 'Shock Resistance', source: 'While Lightning Tempest active, reduce incoming Shock potency by 100%; Tempest has a temporary duration.' })).toEqual([{ target: 'Shock', mechanism: 'POTENCY' }]);
  });
  it('uses specific incoming effects from generic duration records and ignores unresolved potency commentary', () => {
    expect(classifyResistanceSource({ ...base, name: 'Debuff Duration Reduction', source: 'Incoming Bleed effects have reduced duration.' })).toEqual([{ target: 'Bleed', mechanism: 'DURATION' }]);
    expect(classifyResistanceSource({ ...base, name: 'Stun Resistance', source: 'While Lucky, Stun expires {1}% faster (potency unresolved); this is reduced duration.' })).toEqual([{ target: 'Stun', mechanism: 'DURATION' }]);
    expect(classifyResistanceSource({ ...base, name: 'Poison Resistance', source: 'M.O.D.O.K. takes 50% less Poison Damage.' })).toEqual([{ target: 'Poison', mechanism: 'DAMAGE' }]);
  });
  it('recognizes effect damage and future potency protection without treating increased duration as protection', () => {
    expect(classifyResistanceSource({ ...base, source: 'Attacks reduce damage from opponent Passive Degeneration and Direct Damage effects for a short time.' })).toEqual([{ target: 'Degeneration', mechanism: 'DAMAGE' }]);
    expect(classifyResistanceSource({ ...base, source: 'Incoming Bleeds have -95% potency and +50% duration; this is resistance, not immunity.' })).toEqual([{ target: 'Bleed', mechanism: 'POTENCY' }]);
    expect(classifyResistanceSource({ ...base, source: 'Being inflicted with Incinerate lowers potency of future Incinerates by 15%, up to 75%.' })).toEqual([{ target: 'Incinerate', mechanism: 'POTENCY' }]);
  });
  it('retains a verified fixed modifier without treating it as immunity', () => {
    expect(fixedResistancePercent('Incoming Bleed potency is reduced by 150%.', [binding()])).toBe(150);
    expect(fixedResistancePercent('Incoming Bleed potency is reduced by 150%.', [])).toBeNull();
    expect(fixedResistancePercent('Incoming Bleed potency is reduced by 150%.', [binding({ coefficient: 1 })])).toBeNull();
    expect(fixedResistancePercent('Reduce Bleed potency by 150% per stack.', [binding()])).toBeNull();
    expect(fixedResistancePercent('Signature: reduce Bleed potency by 150%.', [binding()])).toBeNull();
    expect(fixedResistancePercent('Synergy: TEST (7★) with Partner (7★): Incoming Bleed potency is reduced by 150%.', [binding()])).toBeNull();
  });
});
