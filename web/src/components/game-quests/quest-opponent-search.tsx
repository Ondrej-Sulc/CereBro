"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ChampionCombobox, type ChampionComboboxOption } from "@/components/comboboxes/ChampionCombobox";
import styles from "./quest-opponent-search.module.css";

export function QuestOpponentSearch({champions,gameId}:{champions:ChampionComboboxOption[];gameId:string}){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  return <div className={styles.picker} aria-busy={pending} data-quest-opponent-search>
    <label htmlFor="quest-opponent-champion">{gameId ? "Change champion" : "Find a champion"}</label>
    <div className={styles.field}><Search aria-hidden="true" />
      <ChampionCombobox id="quest-opponent-champion" champions={champions} value={gameId} placeholder="Search champions…" showSelectedPortrait={false} className={styles.championSelect} disabled={pending} onSelect={id=>startTransition(()=>router.push(id?`/quests/encounters?${new URLSearchParams({gameId:id})}`:"/quests/encounters"))}/>
    </div>
    <p className={styles.hint}>{pending ? <span role="status" className={styles.loading}>Finding quest encounters…</span> : gameId ? "Search by name to explore another opponent." : "Choose an opponent to reveal their quest matches."}</p>
  </div>;
}
