import { describe, expect, it } from 'vitest';
import { filterWarMapPlacements, getMissingDefenseNodeNumbers } from './war-map';

function placement(number: number, assigned = true) {
  return { nodeId: 1000 + number, node: { nodeNumber: number }, defenderId: assigned ? 7 : null, playerId: 'player' };
}

describe('map-scoped defense placements', () => {
  it('does not report nodes 11 or 12 as missing on a complete Big Thing plan', () => {
    const rows = [...Array.from({ length: 10 }, (_, i) => placement(i + 1)), placement(11, false), placement(12, false)];
    expect(getMissingDefenseNodeNumbers(rows, 'BIG_THING')).toEqual([]);
  });

  it('reports a real missing node even when no placement row exists for it', () => {
    expect(getMissingDefenseNodeNumbers(Array.from({ length: 9 }, (_, i) => placement(i + 1)), 'BIG_THING')).toEqual([10]);
  });

  it('requires both player and defender on each real node', () => {
    const rows = Array.from({ length: 10 }, (_, i) => placement(i + 1));
    rows[1].defenderId = null;
    expect(getMissingDefenseNodeNumbers(rows, 'BIG_THING')).toEqual([2]);
  });

  it('excludes off-map assignments without mutating or removing saved rows', () => {
    const rows = [placement(1), placement(11), placement(12)];
    const original = structuredClone(rows);
    expect(filterWarMapPlacements(rows, 'BIG_THING')).toEqual([rows[0]]);
    expect(filterWarMapPlacements(rows, 'STANDARD')).toEqual(rows);
    expect(rows).toEqual(original);
  });
});
