import { describe, expect, it } from 'vitest';
import { resistanceLabel } from './champion-resistance';

describe('source-level resistance descriptions', () => {
  it('preserves meaningful percentages above 100 without claiming immunity', () => {
    expect(resistanceLabel({ mechanism: 'POTENCY', percent: 150 })).toBe('150% potency reduction');
    expect(resistanceLabel({ mechanism: 'DAMAGE', percent: 100 })).toBe('100% damage reduction');
  });
  it('does not invent amounts or conflate duration with potency', () => {
    expect(resistanceLabel({ mechanism: 'DURATION', percent: null })).toBe('duration reduction');
    expect(resistanceLabel({ mechanism: 'POTENCY_AND_DURATION', percent: 65 })).toBe('65% potency and duration reduction');
  });
});
