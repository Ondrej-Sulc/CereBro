"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, Clock3, Trophy } from "lucide-react";
import { useRelicInventory } from "./relic-inventory";
import styles from "./relic-prestige-panel.module.css";

const number = (value: number | null) => value?.toLocaleString("en-US") ?? "—";

export function RelicPrestigePanel() {
  const { profile, entries, prestige } = useRelicInventory();
  if (!prestige || !profile) return null;
  const synced = prestige.automatic && prestige.ready && prestige.recorded === prestige.average;
  const needed = Math.max(0, 30 - entries.length);
  const status = synced ? "Updating automatically" : needed > 0 ? `${needed} more to start automatic prestige` : "Keeping recorded prestige";
  const StatusIcon = synced ? CircleCheck : Clock3;
  return <>
    <section className={styles.panel} aria-label="Relic prestige">
      <div className={styles.metrics}>
        <div className={styles.primaryMetric}>
          <span><Trophy size={16} aria-hidden /> {prestige.ready ? "Top 30 relic prestige" : "Entered relic average"}</span>
          <strong>{number(prestige.average)}</strong>
          <small>{prestige.contributorIds.length} / 30 contributors · {entries.length} owned</small>
        </div>
        <div className={styles.secondaryMetric}>
          <span>{synced ? "Champion prestige" : "Recorded relic prestige"}</span>
          <strong>{number(synced ? prestige.champion : prestige.recorded)}</strong>
          <small>{synced ? "From your profile" : "Current profile value"}</small>
        </div>
        <Link className={styles.secondaryMetric} href="/profile">
          <span>Overall prestige <ArrowRight size={13} aria-hidden /></span>
          <strong>{number(prestige.summoner)}</strong>
          <small>Champion + relic prestige</small>
        </Link>
        <div className={styles.statusArea}>
          <span className={synced ? styles.active : styles.status}><StatusIcon size={14} aria-hidden /> {status}</span>
        </div>
      </div>
      <div className={styles.footnote}>
        <p>{prestige.missingCount > 0
          ? `${prestige.missingCount} relic${prestige.missingCount === 1 ? " has" : "s have"} unavailable prestige. Automatic updates resume when you have at least 30 relics and all ratings are available. Your recorded value is kept meanwhile.`
          : needed > 0
            ? "Prestige updates automatically once you have 30 relics. Add your highest-rated relics for an accurate total; your recorded value is kept until then."
            : "Your highest 30 relics across both types determine relic prestige. It updates automatically as you add, edit or remove relics."}</p>
        <small>Unlocked runes assumed maxed at the selected rank.</small>
      </div>
    </section>
  </>;
}
