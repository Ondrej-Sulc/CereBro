import type { CSSProperties } from "react";
import type { QuestMap } from "@cerebro/core/domain/game-quests";
import type { QuestMapLabelBox } from "@cerebro/core/domain/game-quests/board";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { QuestMapNameplate } from "./quest-map-nameplate";
import styles from "./quest-map-encounter-marker.module.css";

type Props = {
  encounter: QuestMap["encounters"][number]; portrait?: QuestPortrait;
  x: number; y: number; uid: string; index: number; selected: boolean; active: boolean;
  showLabel: boolean; labelBox?: QuestMapLabelBox; labelUnit: number; portalTarget?: boolean;
  onChoose: () => void; onHover: (hovered: boolean) => void;
};

/** A captured placement; all coordinates and identity remain owned by the map. */
export function QuestMapEncounterMarker({ encounter: e, portrait, x, y, uid, index, selected, active, showLabel, labelBox, labelUnit, portalTarget, onChoose, onHover }: Props) {
  const label = portrait?.name ?? e.champion?.name ?? e.name;
  const radius = e.final ? 33 : 27, portraitRadius = e.final ? 31 : 25;
  const accent = e.final ? "#f2c56d" : portrait?.color ?? "#8daec6";
  const style = { "--marker-accent": accent } as CSSProperties;
  const coordinate = e.coordinate.join(",");
  const orbitalRadius = radius + 7;
  return <g role="button" tabIndex={0} aria-pressed={selected}
    aria-label={`${label}, ${e.rarity} stars${e.final ? ", final boss" : ""}${e.pathIndices.length > 1 ? `, shared by ${e.pathIndices.length} recorded routes` : ""}`}
    data-coordinate={coordinate} data-map-coordinate={coordinate} data-map-encounter={e.id}
    data-selected={selected} data-active={active} data-final-boss={e.final}
    className={styles.marker} style={style}
    onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onFocus={() => onHover(true)} onBlur={() => onHover(false)}
    onClick={onChoose} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(); } }}>
    <title>{`${label} · ${e.rarity}★${e.final ? " · Final boss" : ""}`}</title>
    <circle data-map-hit-target aria-hidden="true" pointerEvents="all" cx={x} cy={y} r={radius + 7} fill="transparent" />
    <g aria-hidden="true" pointerEvents="none">
      <circle cx={x} cy={y + 2} r={radius + 2} fill="#010710" opacity=".92" />
      <circle className={styles.halo} cx={x} cy={y} r={radius + 3} fill={accent} fillOpacity={selected ? .15 : .055} stroke={accent} strokeOpacity={selected ? .65 : .2} strokeWidth="1" />
      {portalTarget && <circle data-map-portal-target cx={x} cy={y} r={radius + 10} fill="none" stroke="#cfa9f8" strokeWidth="1.1" strokeDasharray="4 5" opacity=".8" />}
      <circle cx={x} cy={y} r={radius} fill="#0b1a29" stroke={accent} strokeWidth={e.final ? 3 : 2} className={styles.portraitRing} />
      {portrait?.imageUrl ? <image className={styles.portrait} data-map-portrait={e.gameId} href={portrait.imageUrl}
        x={x - portraitRadius} y={y - portraitRadius} width={portraitRadius * 2} height={portraitRadius * 2}
        clipPath={`url(#${uid}-portrait-${index})`} opacity={active || selected ? 1 : .68} /> :
        <g data-map-portrait-fallback fill="#7993a9">
          <circle cx={x} cy={y - 6} r="7" />
          <path d={`M${x - 13} ${y + 14}q0-15 13-15t13 15`} fill="#4d6a82" />
          <path d={`M${x + 13} ${y - 11}a3 3 0 0 1 5 2c0 2-3 2-3 4m0 3v.1`} fill="none" stroke="#adc6d9" strokeWidth="1.5" strokeLinecap="round" />
        </g>}
      <circle className={styles.innerRim} cx={x} cy={y} r={portraitRadius} fill="none" stroke="#e1f3ff" strokeOpacity=".15" strokeWidth=".8" />
      <circle className={styles.focusRing} cx={x} cy={y} r={orbitalRadius} fill="none" stroke="#e4faff" strokeWidth="1.6" />
      {selected && <g data-map-selection className={styles.selection}>
        <circle cx={x} cy={y} r={orbitalRadius} fill="none" stroke="#b9edff" strokeWidth=".9" strokeOpacity=".38" />
        <path d={`M${x - orbitalRadius + 7} ${y - orbitalRadius * .6}a${orbitalRadius} ${orbitalRadius} 0 0 1 ${orbitalRadius * .55} ${-orbitalRadius * .35}
          M${x + orbitalRadius - 7} ${y + orbitalRadius * .6}a${orbitalRadius} ${orbitalRadius} 0 0 1 ${-orbitalRadius * .55} ${orbitalRadius * .35}`}
          fill="none" stroke="#e5fbff" strokeWidth="2.5" strokeLinecap="round" />
        <path d={`M${x - orbitalRadius - 1} ${y}h4m${orbitalRadius * 2 - 6} 0h4M${x} ${y - orbitalRadius - 1}v4`}
          fill="none" stroke="#bdefff" strokeWidth="1.6" strokeLinecap="round" />
      </g>}
      <g className={styles.rarity}>
        <rect x={x - 15} y={y + radius - 6} width="30" height="14" rx="5" fill={e.final ? "#edc56f" : "#071724"} stroke={e.final ? "#ffe3a4" : "#54768f"} strokeWidth=".9" />
        <path d={`M${x - 9} ${y + radius - 4}h18`} stroke={e.final ? "#fff0c4" : "#c5ebff"} strokeOpacity=".22" strokeWidth=".6" />
        <text data-map-rarity x={x} y={y + radius + 4} textAnchor="middle" fill={e.final ? "#30200b" : "#e0f1fc"} fontSize="9" fontWeight="700">{e.rarity}★</text>
      </g>
      {e.final && <g data-map-boss-emblem aria-hidden="true" transform={`translate(${x - radius + 5} ${y + radius - 6})`}>
        <circle r="10" fill="#160e09" stroke="#c78e45" strokeWidth=".9" />
        <path d="M0-10c1 4 5 3 4 7 3-1 3-3 3-3 5 8 1 13-6 13S-9 2-6-3c0 3 3 2 3 0 0-2 1-5 3-7Z" fill="#e59b3a" />
        <path d="M0-3c-3 0-5 2-5 4 0 2 1 3 2 3v3h6V4c1 0 2-1 2-3 0-2-2-4-5-4Z" fill="#fff0c8" />
        <path d="M-3 1h1M2 1h1M0 4v1" stroke="#583015" strokeWidth="1.5" strokeLinecap="round" />
      </g>}
      {e.pathIndices.length > 1 && <g data-map-shared-routes transform={`translate(${x + radius - 2} ${y - radius + 3})`}>
        <circle r="8" fill="#0a2032" stroke="#6488a1" strokeWidth=".9" />
        <text y="3" textAnchor="middle" fill="#d4eafa" fontSize="8" fontWeight="650">{e.pathIndices.length}</text>
      </g>}
      {showLabel && labelBox && <QuestMapNameplate box={labelBox} name={label} accent={accent} selected={selected} unit={labelUnit} />}
    </g>
  </g>;
}
