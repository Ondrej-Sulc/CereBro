"use client";
import { useSyncExternalStore } from "react";
import styles from "./towers.module.css";

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
  return () => {
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("popstate", notify);
  };
};
const currentFloor = () => /^#floor-(\d+)$/.exec(window.location.hash)?.[1] ?? "";
const serverFloor = () => "";

export function TowerFloorJump({ floors }: { floors: { floorNumber: number; name: string }[] }) {
  const hashFloor = useSyncExternalStore(subscribe, currentFloor, serverFloor);
  const selected = floors.some(f => String(f.floorNumber) === hashFloor) ? hashFloor : "";
  return <div className={styles.floorJump}><label htmlFor="tower-floor">Jump to floor</label><div><select id="tower-floor" aria-label="Jump to floor" value={selected} onChange={e => { if (e.target.value) window.location.hash = `floor-${e.target.value}`; }}><option value="" disabled>Choose a defender</option>{floors.map(f => <option key={f.floorNumber} value={f.floorNumber}>{f.floorNumber}. {f.name}</option>)}</select><a href="#block-rewards" className={styles.rewardsJump}>Rewards ↓</a></div></div>;
}
