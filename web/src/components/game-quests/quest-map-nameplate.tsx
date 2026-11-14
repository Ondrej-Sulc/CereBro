import type { QuestMapLabelBox } from "@cerebro/core/domain/game-quests/board";
import styles from "./quest-board.module.css";

export function QuestMapNameplate({ box, name, accent, selected, unit }: {
  box:QuestMapLabelBox;name:string;accent:string;selected:boolean;unit:number;
}) {
  return <g className={styles.nameLabel} data-map-nameplate aria-hidden="true">
    <rect {...box} rx={8*unit} fill="#091725" fillOpacity=".98" stroke={selected ? '#b5eaff' : '#4c667b'} strokeWidth={selected ? 1.3 : .8} vectorEffect="non-scaling-stroke"/>
    <rect x={box.x+6*unit} y={box.y+7*unit} width={3*unit} height={box.height-14*unit} rx={1.5*unit} fill={accent}/>
    <text x={box.x+16*unit} y={box.y+box.height/2+4*unit} fill="#f1f7fc" fontSize={12*unit} fontWeight="600">{name.length>24 ? name.slice(0,22)+'…' : name}</text>
  </g>;
}
