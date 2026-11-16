import { expect, it } from 'vitest';
import { rankGlossarySearchOptions, type GlossarySearchOption } from './glossary-search';

it('matches familiar plural effect names against the singular catalog entry', () => {
  const options: GlossarySearchOption[] = ['Bleed', 'Poison', 'Incinerate', 'Shock', 'Rupture'].map((name, index) => ({
    id: index + 1, name, description: null, iconUrl: null, color: '#b8c5d6', secondaryColor: '#263142', categories: [],
  }));
  for (const option of options) expect(rankGlossarySearchOptions(options, `${option.name.toLowerCase()}s`).map(row => row.id)).toEqual([option.id]);
});

const option = (id: number, name: string, description: string | null = null): GlossarySearchOption => ({
  id, name, description, iconUrl: null, color: '#ffffff', secondaryColor: '#222222', categories: [],
});
const effects = [option(1, 'Ability Accuracy Reduction'), option(2, 'Critical Bleed', 'Deals damage over time.'),
  option(3, 'Bleed', 'A damage over time effect.'), option(4, 'Slow', 'Reduces Unstoppable and Evade ability accuracy.')];

it('prioritizes exact names and name prefixes over definition-only matches', () => {
  expect(rankGlossarySearchOptions(effects, 'bleed').map(row => row.id)).toEqual([3, 2]);
  expect(rankGlossarySearchOptions(effects, 'ability accuracy').map(row => row.id)).toEqual([1, 4]);
  expect(rankGlossarySearchOptions(effects, 'damage time').map(row => row.id)).toEqual([3, 2]);
});

it('accepts reordered words, punctuation, accents and familiar spelling variants', () => {
  expect(rankGlossarySearchOptions(effects, 'REDUC abil acc').map(row => row.id)).toEqual([1, 4]);
  expect(rankGlossarySearchOptions([option(5, 'Armour Break'), option(6, 'Réunion Passive')], 'armor break').map(row => row.id)).toEqual([5]);
  expect(rankGlossarySearchOptions([option(6, 'Réunion Passive')], 'reunion passives').map(row => row.id)).toEqual([6]);
  expect(rankGlossarySearchOptions([option(7, 'Bleed Immunity')], 'immune bleed').map(row => row.id)).toEqual([7]);
});

it('keeps distinct IDs and exact numeric terms while bounding suggestions without mutating data', () => {
  const input = [option(3, 'Bleed'), option(8, 'Bleed'), option(9, 'Level 17 Fury'), option(10, 'Level 7 Fury')];
  const before = structuredClone(input);
  expect(rankGlossarySearchOptions(input, 'bleed', 1).map(row => row.id)).toEqual([3]);
  expect(rankGlossarySearchOptions(input, '7 fury').map(row => row.id)).toEqual([10]);
  expect(rankGlossarySearchOptions(input, 'bleed', 20).map(row => row.id)).toEqual([3, 8]);
  expect(rankGlossarySearchOptions(input, '   ')).toEqual([]);
  expect(rankGlossarySearchOptions(input, 'missing')).toEqual([]);
  expect(rankGlossarySearchOptions(input, 'bleed', 0)).toEqual([]);
  expect(input).toEqual(before);
});

it('preserves native-only definition matches without replacing displayed definitions', () => {
  const input = [{ ...option(20, 'Amplify', 'Increases a recorded potency.'), searchText: 'Native definition mentions Charging Heavy.' }];
  expect(rankGlossarySearchOptions(input, 'charging heavy').map(row => row.id)).toEqual([20]);
  expect(input[0].description).toBe('Increases a recorded potency.');
});
