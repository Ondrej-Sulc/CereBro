import type { WarMapType } from '@prisma/client';
import { warNodesData, warNodesDataBig } from '../data/war-planning/nodes-data';

/** Numeric layout IDs are map node numbers; database WarNode IDs are unrelated. */
export function getWarMapNodeNumbers(mapType: WarMapType): number[] {
  const layout = mapType === 'BIG_THING' ? warNodesDataBig : warNodesData;
  return layout.flatMap(node => typeof node.id === 'number' ? [node.id] : []).sort((a, b) => a - b);
}

export function filterWarMapPlacements<T extends { node: { nodeNumber: number } }>(
  placements: readonly T[], mapType: WarMapType,
): T[] {
  const allowed = new Set(getWarMapNodeNumbers(mapType));
  return placements.filter(placement => allowed.has(placement.node.nodeNumber));
}

export function getMissingDefenseNodeNumbers(
  placements: readonly { node: { nodeNumber: number }; playerId: string | null; defenderId: number | null }[],
  mapType: WarMapType,
): number[] {
  const assigned = new Set(placements.filter(p => p.playerId && p.defenderId).map(p => p.node.nodeNumber));
  return getWarMapNodeNumbers(mapType).filter(number => !assigned.has(number));
}
