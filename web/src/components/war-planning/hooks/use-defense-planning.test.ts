import { act, createElement, useLayoutEffect } from 'react';
import { KonvaRenderer } from 'react-konva/lib/ReactKonvaCore';
import { WarMapType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlacementWithNode } from '@cerebro/core/data/war-planning/types';
import { useDefensePlanning } from './use-defense-planning';

vi.mock('@/lib/observability/client', () => ({ reportClientError: vi.fn() }));

const nodes = Array.from({ length: 50 }, (_, i) => ({ id: 1001 + i, nodeNumber: i + 1, allocations: [], description: null }));
function placement(nodeNumber: number, battlegroup = 1): PlacementWithNode {
  return {
    id: `bg${battlegroup}-node${nodeNumber}`, nodeId: nodes[nodeNumber - 1].id, node: nodes[nodeNumber - 1],
    battlegroup, planId: 'big', defenderId: 7, playerId: 'player', starLevel: 7,
    defender: null, player: null, type: 'defense',
  };
}
let rows: PlacementWithNode[];
let current: ReturnType<typeof useDefensePlanning>;
let root: ReturnType<typeof KonvaRenderer.createContainer>;
let props: Parameters<typeof useDefensePlanning>[0];
function Probe() {
  const state = useDefensePlanning(props);
  useLayoutEffect(() => { current = state; });
  return null;
}
async function render() {
  await act(async () => { KonvaRenderer.updateContainer(createElement(Probe), root, null); });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('document', { hidden: false });
  rows = Array.from({ length: 10 }, (_, i) => placement(i + 1));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.startsWith('/api/war-planning/nodes?') ? nodes : rows,
  ))));
  props = { planId: 'big', mapType: WarMapType.BIG_THING, champions: [], players: [], updatePlacement: vi.fn() };
  const onError = (error: unknown) => { throw error; };
  root = KonvaRenderer.createContainer({}, 1, null, false, null, '', onError, onError, onError, () => {}, null);
});
afterEach(async () => {
  await act(async () => { KonvaRenderer.updateContainer(null, root, null); });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Big Thing defense node scope', () => {
  it('offers no node 11 fallback once its ten nodes are filled', async () => {
    await render();
    expect([...current.nodesMap.keys()]).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(current.currentPlacements).toHaveLength(10);
    expect(current.nodesMap.size).toBe(current.currentPlacements.length);
  });

  it.each(['initial', 'poll'])('excludes saved nodes 11 and 12 from %s duplicate, roster and completeness checks', async source => {
    if (source === 'initial') rows.push(placement(11), placement(12, 3));
    await render();
    if (source === 'poll') {
      rows.push(placement(11), placement(12, 3));
      await act(async () => { vi.advanceTimersByTime(5000); });
    }
    expect(current.currentPlacements.map(p => p.node.nodeNumber)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(current.allPlacements).toHaveLength(10);
  });

  it('retains standard-map nodes 11 and 12', async () => {
    props.mapType = WarMapType.STANDARD;
    rows.push(placement(11), placement(12));
    await render();
    expect(current.nodesMap.size).toBe(50);
    expect(current.currentPlacements).toHaveLength(12);
  });
});
