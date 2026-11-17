import { useId, type CSSProperties } from "react";
import { coordinateKey, type Coordinate } from "@cerebro/core/domain/game-quests";
import styles from "./quest-map-paths.module.css";

type MapEdge = { from: Coordinate; to: Coordinate; portal: boolean };
type Props = {
  edges: readonly MapEdge[];
  point: (coordinate: Coordinate) => Coordinate;
  routeEdges: ReadonlySet<string>;
  routePhases: ReadonlyMap<string, number>;
  highlightRoute: boolean;
};

/** Presentation only: each captured directed edge retains its original endpoints. */
export function QuestMapPaths({ edges, point, routeEdges, routePhases, highlightRoute }: Props) {
  const portalArrowId = `${useId().replace(/:/g, "")}-portal-direction`;
  const portals = new Map<string, { coordinate: Coordinate; active: boolean }>();
  for (const edge of edges) {
    if (!edge.portal) continue;
    const active = !highlightRoute || routeEdges.has(`${coordinateKey(edge.from)}>${coordinateKey(edge.to)}`);
    for (const coordinate of [edge.from, edge.to]) {
      const key = coordinateKey(coordinate);
      portals.set(key, { coordinate, active: active || Boolean(portals.get(key)?.active) });
    }
  }

  return <g className={styles.paths} aria-hidden="true" data-map-paths>
    <defs><marker id={portalArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
      <path d="M1 1 8 5 1 9" fill="none" stroke="#ead5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </marker></defs>
    {edges.map((edge, index) => {
      const from = coordinateKey(edge.from), to = coordinateKey(edge.to), key = `${from}>${to}`;
      const [x1, y1] = point(edge.from), [x2, y2] = point(edge.to);
      const active = highlightRoute && routeEdges.has(key), quiet = highlightRoute && !active;
      const Connection = edge.portal ? "path" : "line";
      const geometry = edge.portal
        ? { d: `M${x1},${y1} Q${(x1 + x2) / 2 + (y2 - y1) * .12},${(y1 + y2) / 2 - (x2 - x1) * .12} ${x2},${y2}`, fill: "none" }
        : { x1, y1, x2, y2 };
      const color = edge.portal ? "#d2a4ff" : "#8dd9ff";
      return <g key={`${key}:${edge.portal}:${index}`}
        data-route-edge data-from={from} data-to={to} data-route-selected={active}
        data-route-portal={edge.portal || undefined} data-route-muted={quiet || undefined}>
        <Connection {...geometry} data-route-casing stroke="#020912" strokeWidth={active ? 8 : 6}
          strokeOpacity={quiet ? .65 : .9} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        <Connection {...geometry} data-route-glow className={styles.glow} stroke={color}
          strokeWidth={active ? 8.5 : 5} strokeOpacity={active ? .24 : quiet ? .055 : .14}
          strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        {active && <Connection {...geometry} className={styles.sheath} stroke={color}
          strokeWidth="3.2" strokeOpacity=".32" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
        <Connection {...geometry} data-route-line className={styles.core}
          stroke={active ? edge.portal ? "#f2e3ff" : "#e2f7ff" : edge.portal ? "#c6a2e5" : "#a9d7ec"}
          strokeWidth={active ? 1.5 : 1.15} strokeOpacity={quiet ? .46 : .92}
          strokeLinecap="round" vectorEffect="non-scaling-stroke" markerEnd={edge.portal ? `url(#${portalArrowId})` : undefined}/>
        <Connection {...geometry} data-route-pulse className={styles.pulse}
          style={{ "--route-phase": `${routePhases.get(key) ?? 0}px` } as CSSProperties}
          stroke={edge.portal ? "#fff6ff" : "#f3fdff"} strokeOpacity={active ? .85 : quiet ? .12 : .26} strokeWidth="2.2" strokeDasharray="9 51"
          strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
      </g>;
    })}
    {[...portals].map(([key, portal]) => {
      const [x, y] = point(portal.coordinate);
      return <g key={key} data-portal-beacon={key} className={styles.portalBeacon} opacity={portal.active ? 1 : .5}>
        <circle cx={x} cy={y} r="21" fill="#a977ef" fillOpacity=".045"/>
      </g>;
    })}
  </g>;
}
