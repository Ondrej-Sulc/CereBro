import { expect, it } from 'vitest';
import { rosterKitOptions } from './roster-kit-options';

it('uses projected effect names and marks resistance-only options for explicit opt-in', () => {
  expect(rosterKitOptions([
    { type: 'ABILITY', ability: { name: 'Damage Reduction' }, resistances: [{ effect: { name: 'Bleed' }, mechanism: 'POTENCY', percent: 150 }] },
    { type: 'IMMUNITY', ability: { name: 'Poison' } },
    { type: 'ABILITY', ability: { name: 'Armor Up' } },
  ])).toEqual({ abilities: [{ id: 'Armor Up', name: 'Armor Up' }], immunities: [
    { id: 'Bleed', name: 'Bleed', resistanceOnly: true }, { id: 'Poison', name: 'Poison', resistanceOnly: false },
  ] });
});
