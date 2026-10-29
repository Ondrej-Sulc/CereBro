"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Loader2, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRelicInventory } from "./relic-inventory";
import styles from "./relic-prestige-panel.module.css";

const number = (value: number | null) => value?.toLocaleString("en-US") ?? "—";

export function RelicPrestigePanel() {
  const { profile, entries, prestige, updateSnapshot } = useRelicInventory();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!prestige || !profile) return null;
  const synced = prestige.automatic && prestige.ready && prestige.recorded === prestige.average;
  const status = synced ? "Updating automatically" : prestige.automatic ? "Automatic updates paused" : "Preview only";
  async function changeSource(enabled: boolean) {
    if (busy || !prestige || !profile) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile/relics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, enabled, revision: prestige.revision, confirmedTop30: confirmed }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          const refreshed = await fetch("/api/profile/relics", { cache: "no-store" });
          if (refreshed.ok) updateSnapshot(await refreshed.json());
          setConfirmed(false);
        }
        throw new Error(result.error ?? "Could not change prestige tracking.");
      }
      updateSnapshot(result.inventory);
      setConfirming(false);
      setConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change prestige tracking.");
    } finally {
      setBusy(false);
    }
  }
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
        <div className={styles.action}>
          <span className={synced ? styles.active : styles.status}><CircleCheck size={14} aria-hidden /> {status}</span>
          {prestige.automatic ? <>
            {prestige.ready && !synced && <button onClick={() => { setConfirming(true); setConfirmed(false); }}>Update from inventory</button>}
            <button className={styles.quiet} disabled={busy} onClick={() => void changeSource(false)}>Stop automatic updates</button>
          </> : <button disabled={!prestige.ready || busy} onClick={() => { setConfirming(true); setConfirmed(false); setError(""); }}>Use for my prestige</button>}
        </div>
      </div>
      <div className={styles.footnote}>
        <p>{prestige.missingCount > 0
          ? `${prestige.missingCount} relic${prestige.missingCount === 1 ? " has" : "s have"} unavailable prestige. The average only includes known values; your recorded prestige is kept.`
          : prestige.contributorIds.length < 30
            ? "Add your top 30 relics to enable automatic prestige. This collection average does not replace your profile value."
            : synced
              ? "Top 30 across both relic types. Prestige updates with your saved builds."
              : "Confirm your highest 30 relics are included before replacing your recorded prestige."}</p>
        <small>Unlocked runes assumed maxed at the selected rank.</small>
      </div>
      {error && !confirming && <p className={styles.error} role="alert">{error}</p>}
    </section>
    <Dialog open={confirming} onOpenChange={(open) => { if (!busy) setConfirming(open); }}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>Use your relic collection for prestige?</DialogTitle>
          <DialogDescription>This replaces your recorded relic prestige for {profile.name}. Future additions, edits and removals will update it automatically.</DialogDescription>
        </DialogHeader>
        <div className={styles.comparison}><span>Relic prestige</span><strong>{number(prestige.recorded)} <ArrowRight size={16} aria-hidden /> {number(prestige.average)}</strong></div>
        <div className={styles.comparison}><span>Overall prestige</span><strong>{number(prestige.summoner)} <ArrowRight size={16} aria-hidden /> {number((prestige.champion ?? 0) + (prestige.average ?? 0))}</strong></div>
        {prestige.champion === null && <p className={styles.note}>Champion prestige is not recorded yet. Overall prestige will contain only the relic contribution until it is recorded.</p>}
        <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} /><span>I have included my 30 highest-prestige relics with their current ranks and signatures.</span></label>
        <p className={styles.note}>Manual edits or a new screenshot import will switch back to the recorded value. You can enable automatic tracking again here.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.submit} disabled={busy || !confirmed || !prestige.ready} onClick={() => void changeSource(true)}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Enable automatic prestige</button>
      </DialogContent>
    </Dialog>
  </>;
}
