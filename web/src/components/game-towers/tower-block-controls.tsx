"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./towers.module.css";

export function towerBlockUrl(id: string, block: number, from?: string) {
  const query = new URLSearchParams({ block: String(block) });
  if (from) query.set("from", from);
  return `/quests/towers/${encodeURIComponent(id)}?${query}`;
}

export function TowerBlockControls({ id, numbers, current, from, compact = false }: { id: string; numbers: number[]; current: number; from?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const index = numbers.indexOf(current), previous = index >= 0 ? numbers[index - 1] : undefined, next = index >= 0 ? numbers[index + 1] : undefined;
  const go = (number: number) => startTransition(() => router.push(towerBlockUrl(id, number, from), { scroll: false }));
  return <nav aria-label={compact ? "Continue through Tower blocks" : "Tower blocks"} className={`${styles.blockControls} ${compact ? styles.bottomControls : ""}`} aria-busy={pending}>
    {previous ? <Link prefetch={false} href={towerBlockUrl(id, previous, from)} className={styles.blockArrow} aria-label={`Previous block, ${previous}`}><ArrowLeft size={18}/><span>Previous</span></Link> : <span className={styles.blockArrow} aria-disabled="true"><ArrowLeft size={18}/><span>Previous</span></span>}
    {compact ? <a href="#block-reader" className={styles.backTop}>Block {current} of {numbers.length} ↑</a> : <div className={styles.blockPicker}><label htmlFor="tower-block">Jump to block</label><select id="tower-block" aria-label="Jump to block" value={current} onChange={e => go(Number(e.target.value))} disabled={pending}>{index < 0 && <option value={current} disabled>Unavailable ({current})</option>}{numbers.map(n => <option key={n} value={n}>{n} of {numbers.length}</option>)}</select></div>}
    {next ? <Link prefetch={false} href={towerBlockUrl(id, next, from)} className={styles.blockArrow} aria-label={`Next block, ${next}`}><span>Next</span><ArrowRight size={18}/></Link> : <span className={styles.blockArrow} aria-disabled="true"><span>Next</span><ArrowRight size={18}/></span>}
    {pending && <span className={styles.loading} role="status">Loading block…</span>}
  </nav>;
}
