import { expect, it } from 'vitest';
import { rosterKitOptions } from './roster-kit-options';

it('uses projected effect names and marks resistance-only options for immunity-only searches', () => {
  expect(rosterKitOptions([
    { type: 'ABILITY', ability: { name: 'Damage Reduction' }, resistances: [{ effect: { name: 'Bleed' }, mechanism: 'POTENCY', percent: 150 }] },
    { type: 'IMMUNITY', ability: { name: 'Poison' } },
    { type: 'ABILITY', ability: { name: 'Armor Up' } },
  ])).toEqual({ abilities: [{ id: 'Armor Up', name: 'Armor Up' }], immunities: [
    { id: 'Bleed', name: 'Bleed', resistanceOnly: true }, { id: 'Poison', name: 'Poison', resistanceOnly: false },
  ] });
});

it('keeps canonical icons and colours across ability, immunity, and resistance options', () => {
  const bleed = { name: 'Bleed', iconUrl: '/effects/bleed.svg', gameGlossaryTerm: { raw: { color_primary: 'DD3344' } } };
  const fury = { name: 'Fury', iconUrl: '/effects/fury.svg', gameGlossaryTerm: { raw: { color_primary: '#FF8800' } } };
  const result = rosterKitOptions([
    { type: 'ABILITY', ability: { name: 'Bleed', iconUrl: null } },
    { type: 'ABILITY', ability: fury },
    { type: 'IMMUNITY', ability: bleed },
    { type: 'ABILITY', ability: { name: 'Damage Reduction', iconUrl: '/effects/reduction.svg' }, resistances: [{ effect: bleed, mechanism: 'POTENCY', percent: 80 }] },
  ]);
  expect(result.abilities).toEqual([
    { id: 'Bleed', name: 'Bleed', iconUrl: '/effects/bleed.svg', color: '#DD3344' },
    { id: 'Fury', name: 'Fury', iconUrl: '/effects/fury.svg', color: '#FF8800' },
  ]);
  expect(result.immunities).toEqual([
    { id: 'Bleed', name: 'Bleed', iconUrl: '/effects/bleed.svg', color: '#DD3344', resistanceOnly: false },
  ]);
});

it('does not borrow the parent ability icon for a resistance target with no icon', () => {
  expect(rosterKitOptions([
    { type: 'ABILITY', ability: { name: 'Damage Reduction', iconUrl: '/effects/reduction.svg' }, resistances: [
      { effect: { name: 'Bleed' }, mechanism: 'POTENCY', percent: 80 },
    ] },
    { type: 'ABILITY', ability: { name: 'Poison', iconUrl: ' ' } },
  ])).toEqual({
    abilities: [{ id: 'Poison', name: 'Poison' }],
    immunities: [{ id: 'Bleed', name: 'Bleed', resistanceOnly: true }],
  });
});

it('uses a later recorded icon when earlier links have no icon and normalizes unknown colours', () => {
  expect(rosterKitOptions([
    { type: 'IMMUNITY', ability: { name: 'Shock', iconUrl: null } },
    { type: 'ABILITY', ability: { name: 'Shock', iconUrl: '/effects/shock.svg', gameGlossaryTerm: { raw: { color_primary: 'invalid' } } } },
  ])).toEqual({
    abilities: [{ id: 'Shock', name: 'Shock', iconUrl: '/effects/shock.svg', color: '#b8c5d6' }],
    immunities: [{ id: 'Shock', name: 'Shock', iconUrl: '/effects/shock.svg', color: '#b8c5d6', resistanceOnly: false }],
  });
});
