"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChampionCombobox, type ChampionComboboxOption } from "@/components/comboboxes/ChampionCombobox";
import styles from "./quest-opponent-lookup.module.css";

export function QuestOpponentSearch({champions,gameId}:{champions:ChampionComboboxOption[];gameId:string}){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const picker=<div className={styles.picker} aria-busy={pending}><label htmlFor="quest-opponent-champion">Find a champion</label><ChampionCombobox id="quest-opponent-champion" champions={champions} value={gameId} placeholder="Search champions…" showSelectedPortrait={false} className={styles.championSelect} disabled={pending} onSelect={id=>startTransition(()=>router.push(id?`/quests/encounters?${new URLSearchParams({gameId:id})}`:"/quests/encounters"))}/>{pending&&<span role="status" className={styles.loading}>Finding quest encounters…</span>}</div>;
  return gameId?<details className={styles.changeChampion}><summary>Change champion</summary>{picker}</details>:picker;
}
