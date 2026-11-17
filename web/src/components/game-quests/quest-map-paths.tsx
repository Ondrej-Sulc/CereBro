import type { CSSProperties } from "react";
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
    {edges.map((edge, index) => {
      const from = coordinateKey(edge.from), to = coordinateKey(edge.to), key = `${from}>${to}`;
      const [x1, y1] = point(edge.from), [x2, y2] = point(edge.to);
      const active = highlightRoute && routeEdges.has(key), quiet = highlightRoute && !active;
      const Connection = edge.portal ? "path" : "line";
      const geometry = edge.portal
        ? { d: `M${x1},${y1} Q${(x1 + x2) / 2 + (y2 - y1) * .12},${(y1 + y2) / 2 - (x2 - x1) * .12} ${x2},${y2}`, fill: "none" }
        : { x1, y1, x2, y2 };
      const color = edge.portal ? "#d2a4ff" : "#8dd9ff";
      const phase=routePhases.get(key)??0;
      // Offset each dash by its length: all three layers share a leading end.
      // Decreasing this positive source-distance phase moves light from → to.
      const pulseStyle=(length:number)=>({"--route-phase":`${phase+length}px`} as CSSProperties);
      return <g key={`${key}:${edge.portal}:${index}`}
        data-route-edge data-from={from} data-to={to} data-route-selected={active}
        data-route-portal={edge.portal || undefined} data-route-muted={quiet || undefined}>
        <Connection {...geometry} data-route-casing stroke="#020912" strokeWidth={active ? 8 : 6}
          strokeOpacity={quiet ? .65 : .9} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        <Connection {...geometry} data-route-glow className={styles.glow} stroke={color}
          strokeWidth={active ? 5.5 : 3.5} strokeOpacity={active ? .16 : quiet ? .035 : .09}
          strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        <Connection {...geometry} data-route-line className={styles.core}
          stroke={active ? edge.portal ? "#dfc6f2" : "#b9e6fa" : edge.portal ? "#ab86c6" : "#82adc5"}
          strokeWidth={active ? 1.35 : 1.05} strokeOpacity={active ? .8 : quiet ? .28 : .65}
          strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        <Connection {...geometry} data-route-pulse-trail className={styles.pulseTrail}
          style={pulseStyle(26)} strokeDashoffset={phase+26}
          stroke={color} strokeOpacity={active ? .28 : quiet ? .09 : .18} strokeWidth="4.6" strokeDasharray="26 34"
          strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        <Connection {...geometry} data-route-pulse-body className={styles.pulseBody}
          style={pulseStyle(13)} strokeDashoffset={phase+13}
          stroke={edge.portal ? "#d5b6fa" : "#9fe5ff"} strokeOpacity={active ? .7 : quiet ? .32 : .55} strokeWidth="3" strokeDasharray="13 47"
          strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        <Connection {...geometry} data-route-pulse className={styles.pulse}
          style={pulseStyle(4)} strokeDashoffset={phase+4}
          stroke={edge.portal ? "#fff4ff" : "#f4ffff"} strokeOpacity={active ? 1 : quiet ? .72 : .98} strokeWidth="1.8" strokeDasharray="4 56"
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
