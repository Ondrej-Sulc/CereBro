import { describe, expect, it } from 'vitest';
import { readGameDisplayBinding, resolveGameDisplayBinding, type GameDisplayBinding } from './game-binding';

const modifier = (type: any, value: number, a = 1, b = 0, c = 0): GameDisplayBinding =>
  ({ version: 1, slot: 1, value, formula: { id: 'test', type, a, b, c } });

describe('named BCG display formulas', () => {
  it.each([
    [modifier('identity', 1), 1], [modifier('mod_x_vara', .02, 100), 2],
    [modifier('mod_x_attk', .15), 1500], [modifier('mod_x_hp', .05), 5000],
    [modifier('standard', .2, 5, 1500, 1), 687.5],
    [modifier('standard_critdam', .7, 5, 1500, 5), 447.6744186],
  ])('evaluates formula %# with its actual coefficients', (binding, expected) => {
    expect(resolveGameDisplayBinding(binding as GameDisplayBinding, 200, { attack: 10000, health: 100000, challengeRating: 250 })).toBeCloseTo(expected as number, 5);
  });
  it('does not invent missing champion stats', () => {
    expect(resolveGameDisplayBinding(modifier('mod_x_attk', .1), 200)).toBeNull();
    expect(resolveGameDisplayBinding(modifier('standard', .1), 200)).toBeNull();
  });
  it('uses growth only on the bound field and returns zero at sig zero', () => {
    const binding: GameDisplayBinding = { version: 1, slot: 2, value: 5,
      growth: { coefficient: 0, curve: { id: 'duration', a: .1, b: .02, c: 1, exponent: .5 } } };
    expect(resolveGameDisplayBinding(binding, 100)).toBe(9);
    expect(resolveGameDisplayBinding(binding, 0)).toBe(0);
    expect(resolveGameDisplayBinding({ version: 1, slot: 2, value: 5 }, 0)).toBe(5);
  });
  it('uses the legacy logarithmic GrowthConst when no named curve exists', () => {
    const binding = { ...modifier('identity', 5), growth: { coefficient: .1 } };
    expect(resolveGameDisplayBinding(binding, 100)).toBeCloseTo(5 + .5 * Math.log(100));
  });
  it('refuses malformed versions, slots, formulas, growth, and nonfinite data', () => {
    for (const value of [{ version: 2, slot: 0, value: 1 }, { version: 1, slot: .5, value: 1 },
      { version: 1, slot: 1, value: 1 }, { version: 1, slot: 0, value: NaN },
      { ...modifier('guessed_formula', 1) }, { version: 1, slot: 3, value: 1, growth: {} }]) {
      expect(() => readGameDisplayBinding(value)).toThrow();
    }
  });
});
