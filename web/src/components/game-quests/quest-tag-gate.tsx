import { LockKeyhole } from "lucide-react";
import { questTagGateLayout, type QuestGateTagGroups } from "@cerebro/core/domain/game-quests/gate-tag-layout";
import styles from "./quest-map-features.module.css";

export function QuestTagGate({ groups, caption, countLabel }: { groups: QuestGateTagGroups; caption: string; countLabel?: string }) {
  const { width, height, rows, bracketGroups } = questTagGateLayout(groups);
  const left = -width / 2, right = width / 2, top = -height / 2, bottom = height / 2;
  const outline = (inset: number) => `M ${left + 10 - inset} ${top - inset} H ${right - 10 + inset} L ${right + inset} ${top + 10 - inset} V ${bottom - 10 + inset} L ${right - 10 + inset} ${bottom + inset} H ${left + 10 - inset} L ${left - inset} ${bottom - 10 + inset} V ${top + 10 - inset} Z`;
  return <g data-gate-kind="tags" data-tag-gate aria-hidden="true">
    <desc>{caption}</desc>
    <path className={styles.gateFrame} d={outline(0)}/>
    <LockKeyhole data-gate-lock x={left + 13} y={top + 7} width="12" height="12" className={styles.tagGateLock}/>
    <text className={styles.tagGateHeading} x={left + 32} y={top + 16}>{countLabel ? `${countLabel} champions` : "Tag requirement"}</text>
    <path className={styles.tagGateDivider} d={`M ${left + 12} ${top + 24} H ${right - 12}`}/>
    {bracketGroups && groups.map((_, group) => {
      const first = rows.findIndex(row => row.group === group), last = rows.findLastIndex(row => row.group === group);
      return <path key={group} className={styles.tagGateBracket} d={`M ${left + 11} ${top + 31 + first * 16} V ${top + 43 + last * 16}`}/>;
    })}
    {rows.map((row, index) => <text key={index} data-gate-tag-row className={row.connector ? styles.tagGateConnector : row.excluded ? styles.tagGateExcluded : styles.tagGateLabel}
      x={left + (bracketGroups ? 18 : 14)} y={top + 41 + index * 16}>{row.text}</text>)}
    <path className={styles.focusRing} d={outline(5)}/>
  </g>;
}
