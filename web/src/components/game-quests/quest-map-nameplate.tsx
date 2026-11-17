import type { QuestMapLabelBox } from "@cerebro/core/domain/game-quests/board";
import styles from "./quest-map-nameplate.module.css";

export function QuestMapNameplate({ box, name, accent, selected, unit }: {
  box:QuestMapLabelBox;name:string;accent:string;selected:boolean;unit:number;
}) {
  return <g className={styles.nameplate} data-map-nameplate aria-hidden="true" pointerEvents="none">
    <rect data-map-nameplate-panel {...box} rx={7*unit} fill="#061421" fillOpacity=".96" stroke={selected ? '#a4dff0' : '#4b697d'} strokeWidth={selected ? 1.1 : .75} vectorEffect="non-scaling-stroke"/>
    <path d={`M${box.x+9*unit} ${box.y+1.5*unit}h${box.width-18*unit}`} fill="none" stroke="#e0f6ff" strokeOpacity={selected?.22:.08} strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
    <rect x={box.x+6*unit} y={box.y+7*unit} width={2.5*unit} height={box.height-14*unit} rx={1.25*unit} fill={accent} opacity={selected?1:.8}/>
    <text x={box.x+15*unit} y={box.y+box.height/2+4*unit} fill={selected?'#f0fbff':'#d5e5ef'} fontSize={12*unit} fontWeight="600">{name.length>24 ? name.slice(0,22)+'…' : name}</text>
    {selected&&<path d={`M${box.x+box.width-9*unit} ${box.y+box.height-2*unit}h${-12*unit}`} stroke={accent} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
  </g>;
}
