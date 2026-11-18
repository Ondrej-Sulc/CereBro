import type { Coordinate } from "@cerebro/core/domain/game-quests";
import type { QuestFlowEdge } from "@cerebro/core/domain/game-quests/path-flow";

/** Batch adjacent styles while preserving disconnected edges and paint order. */
export function questMapOverviewPaths(edges: readonly QuestFlowEdge[], point: (coordinate: Coordinate) => Coordinate) {
  const result: { portal: boolean; d: string }[] = [];
  for (const edge of edges) {
    const from = point(edge.from), to = point(edge.to);
    if (![...from, ...to].every(Number.isFinite)) continue;
    let run = result.at(-1);
    if (!run || run.portal !== edge.portal) { run = { portal: edge.portal, d: '' }; result.push(run); }
    run.d += `M${from[0]} ${from[1]}L${to[0]} ${to[1]}`;
  }
  return result;
}
