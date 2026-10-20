/** The four arguments passed by GameUtils.GetFormattedLocalizedBuff.
 * These are positional game fields, never inferred from English sentences.
 */
export type GameDisplayFormula = {
  id: string;
  type: 'identity' | 'mod_x_vara' | 'mod_x_attk' | 'mod_x_hp' | 'standard' | 'standard_critdam';
  a: number;
  b: number;
  c: number;
};

export type GameDisplayBinding = {
  version: 1;
  slot: 0 | 1 | 2 | 3;
  value: number;
  formula?: GameDisplayFormula;
  growth?: {
    coefficient: number;
    curve?: { id: string; a: number; b: number; c: number; exponent: number };
  };
};

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const formulas = new Set(['identity', 'mod_x_vara', 'mod_x_attk', 'mod_x_hp', 'standard', 'standard_critdam']);

export function readGameDisplayBinding(value: unknown): GameDisplayBinding {
  if (!object(value) || value.version !== 1 || ![0, 1, 2, 3].includes(Number(value.slot))
    || !number(value.slot) || !number(value.value)) throw new Error('Invalid game display binding.');
  if (value.slot === 1) {
    const f = value.formula;
    if (!object(f) || typeof f.id !== 'string' || !formulas.has(String(f.type))
      || !number(f.a) || !number(f.b) || !number(f.c)) throw new Error('Invalid game display formula.');
  } else if (value.formula !== undefined) throw new Error('Only modifier slot has a display formula.');
  if (value.growth !== undefined) {
    const g = value.growth;
    if (value.slot === 3 || !object(g) || !number(g.coefficient)) throw new Error('Invalid game display growth.');
    if (g.curve !== undefined) {
      const c = g.curve;
      if (!object(c) || typeof c.id !== 'string' || !c.id || !number(c.a) || !number(c.b)
        || !number(c.c) || !number(c.exponent)) throw new Error('Invalid game display growth curve.');
    }
  }
  return value as unknown as GameDisplayBinding;
}

export function resolveGameDisplayBinding(binding: GameDisplayBinding, sig: number,
  stats?: { attack?: number | null; health?: number | null; challengeRating?: number | null }) {
  let value = binding.value;
  if (binding.growth) {
    if (sig <= 0) value = 0;
    else {
      const curve = binding.growth.curve;
      value += curve ? curve.a * Math.pow(sig, curve.exponent) + curve.b * sig + curve.c
        : value * binding.growth.coefficient * Math.log(sig);
    }
  }
  if (!Number.isFinite(value)) return null;
  if (binding.slot === 0) return Math.round(value * 10_000) / 100;
  if (binding.slot === 2) return Math.round(value * 100) / 100;
  if (binding.slot === 3) return value;
  const formula = binding.formula!;
  switch (formula.type) {
    case 'identity': break;
    case 'mod_x_vara': value *= formula.a; break;
    case 'mod_x_attk':
      if (stats?.attack == null) return null;
      value *= stats.attack; break;
    case 'mod_x_hp':
      if (stats?.health == null) return null;
      value *= stats.health; break;
    case 'standard': {
      const denominator = Math.abs(1 - Math.abs(value));
      if (denominator === 0) return 0;
      if (stats?.challengeRating == null) return null;
      value = (formula.a * stats.challengeRating + formula.b) * value / denominator;
      break;
    }
    case 'standard_critdam': {
      const denominator = value - formula.c;
      if (denominator === 0) return 0;
      if (stats?.challengeRating == null) return null;
      value = (-value * formula.a * stats.challengeRating - value * formula.b) / denominator;
      break;
    }
  }
  return Number.isFinite(value) ? Math.abs(value) : null;
}
