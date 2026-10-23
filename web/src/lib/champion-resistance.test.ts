import { describe, expect, it } from 'vitest';
import { buildRosterKitSections, matchesRosterKitFilters, type RosterKitLink } from './roster-kit';
import { groupChampionKitSources } from './champion-kit';
import { prepareChampionAbilityTextView } from './champion-ability-text';
import { buildRosterKitDetails } from './roster-kit-details';

const filters = { abilities: [], immunities: [], categories: [] };
const ability = (name: string) => ({ name, description: null, iconUrl: null, gameGlossaryTermId: null, gameGlossaryTerm: null, categories: [] });
const resistance: RosterKitLink = {
  id: 1, type: 'ABILITY', source: 'Incoming Bleed potency is reduced by 150%; this does not prevent Bleed application.',
  effectDirection: 'GAIN', effectForm: 'UNKNOWN', ability: ability('Damage Reduction'), synergyChampions: [],
  overviewSummary: 'Incoming Bleed potency is reduced without preventing Bleed application.',
  resistances: [{ effect: ability('Bleed'), mechanism: 'POTENCY', percent: 150 }],
};
const signatureRecord = { id: 79407, group: 'signature', title: 'SWARM ACCELERATOR', template: {
  raw: 'Incoming Bleed and Incinerate effects suffer -{1}% duration.', blocks: [{ type: 'paragraph', children: [
    { type: 'text', value: 'Incoming Bleed and Incinerate effects suffer -' },
    { type: 'value', key: 'placeholder_1', placeholderIndex: 1, source: { kind: 'abilityParam', componentId: 'antfu_sig_dot_dur_200', buffType: 'duration_percent', paramName: 'modifier', gameBinding: {
      version: 1, slot: 1, value: 0.10000000149011612,
      formula: { id: 'var_x_a', type: 'mod_x_vara', a: 100, b: 0, c: 0 },
      growth: { coefficient: 0, curve: { id: 'crv_antfu_dot_dur_200', a: 0.00796509999781847, b: 0, c: 0, exponent: 0.8700000047683716 } },
    } } }, { type: 'text', value: '% duration.' },
  ] }],
} };
const signatureEntry: RosterKitLink = { ...resistance, source: 'Signature ability: incoming Bleed effects have 10-90% reduced duration (legacy range).',
  overviewSummary: 'With his signature ability, incoming Bleed effects on Ant-Man have reduced duration.',
  resistances: [{ effect: ability('Bleed'), mechanism: 'DURATION', percent: null, valueRecords: [signatureRecord] }],
};

describe('resistance discovery', () => {
  it('projects a source-backed resistance alongside immunities without rewriting its source', () => {
    const before = structuredClone(resistance);
    const sections = buildRosterKitSections([resistance], filters);
    const protection = sections[0];
    expect(protection.title).toBe('Immunities & resistances');
    expect(protection.effects.map(e => [e.name, e.type])).toEqual([['Bleed', 'RESISTANCE']]);
    expect(sections.flatMap(s => s.effects).some(e => e.name === 'Damage Reduction')).toBe(false);
    const groups = groupChampionKitSources(protection.effects[0], prepareChampionAbilityTextView({ records: [] }));
    expect(groups[0].nativeSources[0].resistance).toEqual({ mechanism: 'POTENCY', percent: 150 });
    expect(groups[0].nativeSources[0].condition).toContain('without preventing Bleed application');
    expect(resistance).toEqual(before);
  });
  it('requires explicit opt-in for resistance matches and highlights only matching protection', () => {
    const selected = { ...filters, immunities: ['Bleed'] };
    expect(matchesRosterKitFilters([resistance], selected)).toBe(false);
    expect(matchesRosterKitFilters([resistance], { ...selected, includeResistances: true })).toBe(true);
    expect(buildRosterKitSections([resistance], selected)[0].effects[0].matched).toBe(false);
    expect(buildRosterKitSections([resistance], { ...selected, includeResistances: true })[0].effects[0].matched).toBe(true);
  });
  it('keeps actual immunity and resistance applications distinct for the same effect', () => {
    const entries = [resistance, { ...resistance, id: 2, type: 'IMMUNITY', resistances: [], ability: ability('Bleed') }];
    const effects = buildRosterKitSections(entries, filters)[0].effects;
    expect(effects.map(e => e.type).sort()).toEqual(['IMMUNITY', 'RESISTANCE']);
    expect(matchesRosterKitFilters(entries, { ...filters, immunities: ['Bleed'] })).toBe(true);
  });

  it('shows signature-scaled recorded values at the selected build without flattening them into fixed metadata', () => {
    const before = structuredClone(signatureEntry);
    const effect = buildRosterKitSections([signatureEntry], filters)[0].effects[0];
    for (const [sigLevel, expected] of [[1, '-10.8%'], [200, '-90%']] as const) {
      const groups = groupChampionKitSources(effect, prepareChampionAbilityTextView({ records: [] }), [], { sigLevel });
      expect(groups[0].nativeSources[0].values).toEqual([{ label: `Sig ${sigLevel}`, text: `Incoming Bleed and Incinerate effects suffer ${expected} duration.` }]);
      expect(groups[0].nativeSources[0].condition).toBe(signatureEntry.overviewSummary);
      expect(groups[0].nativeSources[0].resistance?.percent).toBeNull();
    }
    const unawakened = groupChampionKitSources(effect, prepareChampionAbilityTextView({ records: [] }), [], { sigLevel: 0 });
    expect(unawakened[0].nativeSources[0].values).toEqual([{ label: 'Unawakened', text: 'Signature ability inactive at Sig 0.' }]);
    expect(signatureEntry).toEqual(before);
  });

  it('labels default catalog previews and uses the owned roster signature when supplied', () => {
    const preview = buildRosterKitDetails([signatureEntry], [], 7);
    expect(preview.groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values?.[0].label).toBe('Sig 200 preview');
    const owned = buildRosterKitDetails([signatureEntry], [], 7, [], { sigLevel: 1 });
    expect(owned.groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values?.[0]).toMatchObject({ label: 'Sig 1', text: expect.stringContaining('-10.8%') });
  });

  it('uses the exact imported 99-Sig variant for a four-star build', () => {
    const curve = { id: 1, curveId: 'antman_future:antfu_sig_dot_dur_99:crv_antfu_dot_dur_99', kind: 'signature', formula: 'signature', minSig: 0, maxSig: 99,
      params: { f2: 0.01468500029295683, f3: 0, f4: 0, f5: 0.8700000047683716, sourceCurveId: 'crv_antfu_dot_dur_99', source: {
        componentId: 'antfu_sig_dot_dur_99', ability: { buffType: 'duration_percent', paramName: 'modifier', chance: 0.1000000014901161 },
      } } };
    const details = buildRosterKitDetails([signatureEntry], [], 4, [], { sigLevel: 99 }, [curve]);
    expect(details.groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values?.[0].text).toContain('-90%');
    const wrong = structuredClone(curve);
    wrong.params.source.ability.buffType = 'regen';
    expect(buildRosterKitDetails([signatureEntry], [], 4, [], { sigLevel: 99 }, [wrong])
      .groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values).toBeUndefined();
    expect(buildRosterKitDetails([signatureEntry], [], 4, [], { sigLevel: 99 })
      .groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values).toBeUndefined();
  });

  it('keeps per-stack bases, caps and conditions in the exact recorded passage', () => {
    const text = 'Each Armor Up reduces incoming Bleed Debuff potency by 25%, up to 100%.';
    const entry = { ...signatureEntry, source: text, overviewSummary: 'Each Armor Up reduces incoming Bleed potency, up to the cap.',
      resistances: [{ effect: ability('Bleed'), mechanism: 'POTENCY' as const, percent: null,
        valueRecords: [{ id: 8, group: 'base', title: null, template: { raw: text } }] }] };
    const details = buildRosterKitDetails([entry], []);
    expect(details.groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values).toEqual([{ label: 'Recorded values', text }]);
    expect(details.entries[0].resistances?.[0].percent).toBeNull();
  });

  it.each([
    ['Power Burn', 'POTENCY', 'The Serpent reduces the potency of incoming Power Drain and Burn effects by 60%.'],
    ['Power Lock', 'DURATION', 'Aarkus reduces the potency of Power Drain, Steal, and Burn effects by 80%, and the duration of Power and Special Lock effects by 75%.'],
    ['Power Steal', 'POTENCY', 'The Opponent’s effects that Steal, Burn, or Drain Sentinel’s Power suffer 30% reduced potency.'],
  ] as const)('recognizes elided %s lists without changing the recorded wording', (effect, mechanism, text) => {
    const entry = { ...signatureEntry, source: text, overviewSummary: text,
      resistances: [{ effect: ability(effect), mechanism, percent: null, valueRecords: [{ id: 4, group: 'base', title: null, template: { raw: text } }] }] };
    expect(buildRosterKitDetails([entry], []).groups[`IMMUNITY:RESISTANCE:${effect}`][0].nativeSources[0].values).toEqual([{ label: 'Recorded values', text }]);
  });

  it('never fills an unresolved game parameter or borrows a healing percentage', () => {
    const records = [
      { id: 1, group: 'signature', title: null, template: { raw: 'Incoming Bleed potency is reduced by {1}%.', blocks: [{ type: 'paragraph', children: [
        { type: 'text', value: 'Incoming Bleed potency is reduced by ' }, { type: 'value', key: 'missing', placeholderIndex: 1 }, { type: 'text', value: '%.' },
      ] }] } },
      { id: 2, group: 'signature', title: null, template: { raw: 'When Bleed expires, Regenerate 90% of missing Health.' } },
    ];
    const details = buildRosterKitDetails([{ ...signatureEntry, resistances: [{ effect: ability('Bleed'), mechanism: 'POTENCY', percent: null, valueRecords: records }] }], []);
    expect(details.groups['IMMUNITY:RESISTANCE:Bleed'][0].nativeSources[0].values).toBeUndefined();
  });

  it('does not confuse outgoing damage or an unrelated reduction with incoming protection', () => {
    for (const [effect, mechanism, text] of [
      ['Poison', 'DAMAGE', 'While Acid Burn is active, the Opponent is inflicted with a Poison Debuff dealing 0 damage and reducing health recovery by 30%.'],
      ['Shock', 'POTENCY', 'Lightning Tempest: Shock potency is increased by up to 90%. Additionally, each Prowess reduces the Opponent’s Defensive Combat Power Rate by 25%.'],
    ] as const) {
      const entry = { ...signatureEntry, source: 'Incoming effects have reduced potency.', overviewSummary: 'Incoming effects have reduced potency.',
        resistances: [{ effect: ability(effect), mechanism, percent: null, valueRecords: [{ id: 3, group: 'base', title: null, template: { raw: text } }] }] };
      expect(buildRosterKitDetails([entry], []).groups[`IMMUNITY:RESISTANCE:${effect}`][0].nativeSources[0].values).toBeUndefined();
    }
  });

  it('uses the matching synergy recipient and keeps a different champion’s percentage separate', () => {
    const partners = [{ champion: { name: 'Odin', slug: 'odin', images: null } }, { champion: { name: 'Ultron', slug: 'ultron', images: null } }];
    const entry: RosterKitLink = { ...signatureEntry,
      source: 'Synergy: DEADLIEST MENACE OF YESTERDAY (7★) with Odin (7★) OR Ultron (7★); does not stack: Incoming Shock effects have 60% reduced duration.',
      overviewSummary: 'Incoming Shock effects on Ant-Man have reduced duration through this synergy.', synergyChampions: partners,
      resistances: [{ effect: ability('Shock'), mechanism: 'DURATION', percent: null }],
    };
    const card = { id: 'antfu_02', name: 'DEADLIEST MENACE OF YESTERDAY', unique: true,
      description: '[64acff]Ant-Man (Future):[-] Incoming Shock effects suffer -60% duration.\n[64acff]Odin:[-] Incoming Shock effects suffer -50% duration.',
      partners: partners.map((p, id) => ({ ...p.champion, id, rarities: [7] })),
    };
    const details = buildRosterKitDetails([entry], [], 7, [card], { championName: 'Ant-Man (Future)' });
    const values = details.groups['IMMUNITY:RESISTANCE:Shock'][0].synergies[0].links[0].values;
    expect(values).toEqual([{ label: 'Synergy values', text: 'Ant-Man (Future): Incoming Shock effects suffer -60% duration.' }]);
    expect(buildRosterKitDetails([entry], [], 7, [{ ...card, partners: [] }], { championName: 'Ant-Man (Future)' })
      .groups['IMMUNITY:RESISTANCE:Shock'][0].synergies[0].links[0].values).toBeUndefined();
  });
});
