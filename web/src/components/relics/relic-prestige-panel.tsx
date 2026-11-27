"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ChevronDown, CircleCheck, Clock3 } from "lucide-react";
import { useRelicInventory } from "./relic-inventory";
import styles from "./relic-prestige-panel.module.css";

const number = (value: number | null) => value?.toLocaleString("en-US") ?? "—";

export function RelicCollectionSummary({ identity, actions }: { identity: ReactNode; actions: ReactNode }) {
  const { profile, entries, prestige } = useRelicInventory();
  const synced = prestige?.automatic && prestige.ready && prestige.recorded === prestige.average;
  const needed = Math.max(0, 30 - entries.length);
  const status = synced ? "Updating automatically" : needed > 0 ? `${needed} more to start automatic prestige` : "Keeping recorded prestige";
  const StatusIcon = synced ? CircleCheck : Clock3;
  return (
    <section className={styles.summary} aria-label="Relic collection summary">
      <div className={styles.overview}>
        <div className={styles.identity}>{identity}</div>
        {profile && prestige && (
          <dl className={styles.metrics} aria-label="Relic prestige">
            <div>
              <dt>{prestige.ready ? "Top 30 relic prestige" : "Entered relic average"}</dt>
              <dd>{number(prestige.average)}</dd>
            </div>
            <div>
              <dt>{synced ? "Champion prestige" : "Recorded relic prestige"}</dt>
              <dd>{number(synced ? prestige.champion : prestige.recorded)}</dd>
            </div>
            <div>
              <dt><Link href="/profile">Overall prestige <ArrowRight size={12} aria-hidden /></Link></dt>
              <dd>{number(prestige.summoner)}</dd>
            </div>
          </dl>
        )}
        <div className={styles.actions}>{actions}</div>
      </div>
      {profile && prestige && (
        <div className={styles.statusRow}>
          <span>{prestige.contributorIds.length} / 30 contributors · {entries.length} owned</span>
          <span className={synced ? styles.active : styles.status}><StatusIcon size={14} aria-hidden /> {status}</span>
          <details className={styles.explanation}>
            <summary>How prestige works <ChevronDown size={13} aria-hidden /></summary>
            <p>{prestige.missingCount > 0
              ? `${prestige.missingCount} relic${prestige.missingCount === 1 ? " has" : "s have"} unavailable prestige. Automatic updates resume when you have at least 30 relics and all ratings are available. Your recorded value is kept meanwhile.`
              : needed > 0
                ? "Prestige updates automatically once you have 30 relics. Add your highest-rated relics for an accurate total; your recorded value is kept until then."
                : "Your highest 30 relics across both types determine relic prestige. It updates automatically as you add, edit or remove relics."}</p>
            <small>Unlocked runes assumed maxed at the selected rank.</small>
          </details>
        </div>
      )}
    </section>
  );
}
