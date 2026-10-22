import { describe, expect, it } from 'vitest';
import { buildRosterKitSections, matchesRosterKitFilters, type RosterKitLink } from './roster-kit';
import { groupChampionKitSources } from './champion-kit';
import { prepareChampionAbilityTextView } from './champion-ability-text';

const filters = { abilities: [], immunities: [], categories: [] };
const ability = (name: string) => ({ name, description: null, iconUrl: null, gameGlossaryTermId: null, gameGlossaryTerm: null, categories: [] });
const resistance: RosterKitLink = {
  id: 1, type: 'ABILITY', source: 'Incoming Bleed potency is reduced by 150%; this does not prevent Bleed application.',
  effectDirection: 'GAIN', effectForm: 'UNKNOWN', ability: ability('Damage Reduction'), synergyChampions: [],
  overviewSummary: 'Incoming Bleed potency is reduced without preventing Bleed application.',
  resistances: [{ effect: ability('Bleed'), mechanism: 'POTENCY', percent: 150 }],
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
});
