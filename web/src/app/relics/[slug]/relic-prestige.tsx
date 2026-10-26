"use client";

import { useId } from "react";
import { useSearchParams } from "next/navigation";
import { Trophy } from "lucide-react";
import {
  relicPrestigeAtBuild,
  selectRelicPrestigeBuild,
  type RelicPrestigeRank,
} from "@cerebro/core/domain/relic-prestige";
import styles from "./relic-prestige.module.css";

export function RelicPrestige({ ranks, maxRank, maxSignature }: {
  ranks: RelicPrestigeRank[];
  maxRank: number;
  maxSignature: number;
}) {
  const query = useSearchParams();
  const id = useId();
  const { rank, signature } = selectRelicPrestigeBuild(
    { maxRank, maxSignature }, query.get("rank"), query.get("sig"),
  );
  const prestige = relicPrestigeAtBuild(ranks, rank, signature);
  const select = (key: "rank" | "sig", value: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, String(value));
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const commitSignature = (input: HTMLInputElement) => {
    const value = /^\d+$/.test(input.value)
      ? Math.min(maxSignature, Number(input.value)) : signature;
    input.value = String(value);
    select("sig", value);
  };
  // A missing capture must never look like a zero rating or an estimate.
  if (prestige === null) return null;
  return (
    <section className={styles.panel} aria-label="Relic prestige calculator">
      <div className={styles.result}>
        <span className={styles.label}><Trophy size={15} aria-hidden="true" /> Prestige</span>
        <output aria-live="polite" aria-atomic="true">{prestige.toLocaleString("en-US")}</output>
        <span className={styles.note}>With runes maxed for this rank</span>
      </div>
      <div className={styles.controls}>
        <div>
          <span id={`${id}-rank`} className={styles.label}>Rank</span>
          <div className={styles.ranks} role="group" aria-labelledby={`${id}-rank`}>
            {ranks.map(entry => (
              <button type="button" key={entry.rank} aria-pressed={rank === entry.rank}
                onClick={() => select("rank", entry.rank)}>{entry.rank}</button>
            ))}
          </div>
        </div>
        <div className={styles.signature}>
          <div className={styles.signatureHeading}>
            <label htmlFor={`${id}-sig`} className={styles.label}>Signature</label>
            <input id={`${id}-sig`} type="number" inputMode="numeric" min={0} max={maxSignature} step={1}
              key={signature} defaultValue={signature}
              onBlur={event => commitSignature(event.currentTarget)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </div>
          <input type="range" aria-label="Signature level" min={0} max={maxSignature} step={1}
            value={signature} onChange={event => select("sig", Number(event.target.value))} />
          <div className={styles.rangeLabels}><span>0 · Unawakened</span><span>{maxSignature}</span></div>
        </div>
      </div>
    </section>
  );
}
