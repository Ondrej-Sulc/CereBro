"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Camera, Check, ChevronDown, ImagePlus, Images, Loader2, ScanLine, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRelicInventory } from './relic-inventory';
import { RelicScreenshotPreview } from './relic-screenshot-preview';
import { RelicScreenshotChoices } from './relic-screenshot-choices';
import { RelicAttributeGlyph } from './relic-picker';
import type { RelicAttributeIcon } from '@/lib/relic-attribute-icons';
import { selectRelicReviewBuild, summarizeRelicReview, type RelicReviewRow } from './relic-screenshot-review';
import type { RelicScreenshotRow } from '@cerebro/core/domain/relic-screenshot';
import type { OwnedRelic, RelicInventorySnapshot } from '@cerebro/core/domain/player-relics';
import styles from './relic-screenshot-import.module.css';

export function RelicScreenshotImport({ disabled = false, attributeIcons }: { disabled?: boolean; attributeIcons: Record<string, RelicAttributeIcon> }) {
  const inventory = useRelicInventory();
  const [open, setOpen] = useState(false);
  return <>
    <button className={styles.launch} disabled={disabled} onClick={() => setOpen(true)}><Camera size={17} /> Import screenshots</button>
    {open && inventory.profile && <ScreenshotDialog key={inventory.profile.id} attributeIcons={attributeIcons} onClose={() => setOpen(false)} />}
  </>;
}

function ScreenshotDialog({ onClose, attributeIcons }: { onClose: () => void; attributeIcons: Record<string, RelicAttributeIcon> }) {
  const { profile, entries, prestige, updateSnapshot } = useRelicInventory();
  const [rows, setRows] = useState<RelicReviewRow[]>([]);
  const [reviewEntries, setReviewEntries] = useState(entries);
  const [revision, setRevision] = useState(prestige?.revision ?? '');
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState<{ completed:number; total:number } | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const urls = useRef<string[]>([]);
  const alive = useRef(true);
  const operation = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    const imageUrls = urls.current;
    return () => { alive.current = false; abort.current?.abort(); imageUrls.forEach(URL.revokeObjectURL); };
  }, []);
  const review = summarizeRelicReview(rows);
  const conflict = review.conflictIds.size > 0;
  const patch = (id: string, changes: Partial<RelicReviewRow>) => {
    setRows(old => old.map(row => row.id === id ? { ...row, ...changes } : row));
  };
  function focusNext(id: string) {
    const next = [...review.decisions, ...review.unmatched].find(row => row.id !== id);
    requestAnimationFrame(() => document.getElementById(next ? `review-card-${next.id}` : 'relic-review-ready')?.focus({preventScroll:true}));
  }
  function choose(row: RelicReviewRow, choice: number, selectionSource: RelicReviewRow['selectionSource'] = 'manual') {
    patch(row.id, { choice, selectionSource, included:true, skipped:false, pendingVariantId:null });
    setEditingId(null);
    const match = row.matches[choice];
    setAnnouncement(`${row.name}${match.secondaryAttribute ? `, ${match.secondaryAttribute}` : ''}: rank ${match.rank}, signature ${match.sigLevel} selected.`);
    focusNext(row.id);
  }
  function leaveOut(row: RelicReviewRow) {
    patch(row.id, { included:false, skipped:true });
    setEditingId(null);
    setAnnouncement(`${row.name} left out. You can restore it below.`);
    focusNext(row.id);
  }
  async function scan(files: File[]) {
    if (!profile || operation.current || !files.length) return;
    setErrors([]);
    if (files.length > 6) { setErrors(['Choose up to 6 screenshots at a time.']); return; }
    if (rows.length >= 160) { setErrors(['Save this batch before scanning more screenshots.']); return; }
    if (files.some(file => file.size > 8*1024*1024)) { setErrors(['Use screenshots smaller than 8 MB each.']); return; }
    if (files.some(file => !['image/png','image/jpeg','image/webp'].includes(file.type))) { setErrors(['Use PNG, JPEG or WebP images.']); return; }
    operation.current = true;
    setProgress({completed:0,total:files.length});
    try {
      for (const [index, file] of files.entries()) {
        if (!alive.current) break;
        setBusy(`Reading screenshot ${index+1} of ${files.length}`);
        try {
          const form = new FormData(); form.set('profileId', profile.id); form.set('image', file);
          abort.current = new AbortController();
          const response = await fetch('/api/profile/relics/screenshots', { method:'POST', body:form, signal:abort.current.signal });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not read this screenshot.');
          if (result.profileId !== profile.id || !alive.current) break;
          const snapshot = result.inventory as RelicInventorySnapshot;
          if (snapshot.profile?.id !== profile.id) throw new Error('Your active profile changed. Reopen the import and try again.');
          setReviewEntries(snapshot.entries);
          const url = URL.createObjectURL(file); urls.current.push(url);
          const scanned = result.rows as RelicScreenshotRow[];
          setRows(old => [...old, ...scanned.map(row => {
            const selection = selectRelicReviewBuild(row, snapshot.entries);
            return { ...row, fileName:file.name, imageUrl:url, ...selection, included:selection.choice !== null, skipped:false };
          })]);
          setImageCount(count => count+1);
          setProgress({completed:index+1,total:files.length});
          // A later scan must not silently acknowledge edits made in another tab.
          if (rows.length === 0 && index === 0) { setRevision(result.inventory.prestige.revision); updateSnapshot(result.inventory); }
        } catch (cause) {
          if (!alive.current) break;
          setErrors(old => [...old, `${file.name}: ${cause instanceof Error ? cause.message : 'Could not read this image.'}`]);
          // Stop after a quota/profile/network failure rather than making more paid requests.
          break;
        }
      }
    } finally {
      operation.current = false;
      if (alive.current) { setBusy(''); setProgress(null); }
    }
  }
  function paste(event: ClipboardEvent<HTMLDivElement>) {
    const clipboardFiles = Array.from(event.clipboardData.files);
    const files = (clipboardFiles.length ? clipboardFiles : Array.from(event.clipboardData.items)
      .filter(item => item.kind === 'file').flatMap(item => { const file = item.getAsFile(); return file ? [file] : []; }))
      .filter(file => file.type.startsWith('image/'));
    if (!files.length || saved) return;
    event.preventDefault();
    if (operation.current) return;
    void scan(files.map((file,index) => new File([file], `Clipboard ${imageCount+index+1}.${file.type.split('/')[1]}`, {type:file.type})));
  }
  async function save() {
    if (!profile || operation.current || conflict || !review.selected.length) return;
    operation.current = true;
    setBusy('Saving reviewed relics'); setErrors([]);
    try {
      const response = await fetch('/api/profile/relics/screenshots', { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({
        profileId:profile.id, revision, entries:review.selected.map(({relicId,stars,rank,sigLevel,expectedPrestige}) => ({relicId,stars,rank,sigLevel,expectedPrestige})),
      }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          const fresh = await fetch('/api/profile/relics', {cache:'no-store'});
          if (fresh.ok) {
            const snapshot = await fresh.json() as RelicInventorySnapshot;
            if (snapshot.profile?.id === profile.id) { updateSnapshot(snapshot); setReviewEntries(snapshot.entries); setRevision(snapshot.prestige!.revision); }
          }
        }
        throw new Error(result.error || 'Could not save the batch.');
      }
      updateSnapshot(result.inventory); setSaved(true);
    } catch (cause) { if (alive.current) setErrors([cause instanceof Error ? cause.message : 'Could not save the batch.']); }
    finally { operation.current = false; if (alive.current) setBusy(''); }
  }
  function card(row: RelicReviewRow, compact = false) {
    const match = row.choice === null ? null : row.matches[row.choice];
    const existing = match ? reviewEntries.find(entry => entry.relicId === match.relicId && entry.stars === match.stars) : undefined;
    return <ReviewCard key={row.id} attributeIcons={attributeIcons} row={row} compact={compact} expanded={editingId === row.id} disabled={!!busy}
      conflict={review.conflictIds.has(row.id)} existing={existing} onChoose={choice => choose(row,choice)} onLeaveOut={() => leaveOut(row)}
      onVariantChange={relicId => {
        const selection = selectRelicReviewBuild(row, reviewEntries, relicId);
        if (selection.choice !== null) choose(row, selection.choice, selection.selectionSource);
        else { patch(row.id, {pendingVariantId:relicId, choice:null, selectionSource:null, included:false}); setEditingId(null); }
      }}
      onEdit={() => setEditingId(editingId === row.id ? null : row.id)} />;
  }
  return <Dialog open onOpenChange={value => { if (!value && !operation.current) onClose(); }}>
    <DialogContent className={styles.dialog} onPaste={paste} onEscapeKeyDown={event => { if (operation.current) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
      <DialogHeader className={styles.header}>
        <div className={styles.title}><span className={styles.titleIcon}><ScanLine size={22} /></span><div><DialogTitle>Import relic screenshots</DialogTitle><DialogDescription>Build {profile?.name}’s collection from the game’s My Relics grid.</DialogDescription></div>
          <button aria-label="Close import" disabled={!!busy} onClick={onClose}><X size={20} /></button></div>
      </DialogHeader>
      <span className={styles.srOnly} role="status">{announcement}</span>
      {saved ? <div className={styles.success}><ShieldCheck size={38} /><h3>{review.uniqueCount} {review.uniqueCount === 1 ? 'relic' : 'relics'} saved</h3><p>The rest of your collection is unchanged.</p><button onClick={onClose}>Done</button></div> : <>
        <div className={styles.body}>
          {!!rows.length && <section className={styles.summary} aria-label="Scan summary">
            <div className={styles.summaryTitle}><div><span className={styles.eyebrow}>SCAN RESULTS</span><h2>{rows.length} relic cards found</h2></div><span className={styles.imageCount}><Images size={15} />{imageCount} {imageCount === 1 ? 'screenshot' : 'screenshots'} processed</span></div>
            <div className={styles.metrics}>
              <a href="#relic-review-decisions" className={styles.decisionMetric}><TriangleAlert size={18} /><strong>{review.decisions.length}</strong><span>Need a choice</span></a>
              <a href="#relic-review-ready" className={styles.readyMetric}><Check size={18} /><strong>{review.ready.length}</strong><span>Ready cards</span></a>
              <a href={review.unmatched.length ? '#relic-review-unmatched' : undefined}><ScanLine size={18} /><strong>{review.unmatched.length}</strong><span>Manual entry</span></a>
            </div>
          </section>}
          <label className={`${styles.upload} ${rows.length ? styles.uploadCompact : ''} ${busy ? styles.uploadBusy : ''}`}>
            <span className={styles.uploadIcon}><ImagePlus size={rows.length ? 20 : 30} /></span>
            <span><strong>{rows.length ? 'Add more screenshots' : 'Paste your screenshots here'}</strong><span className={styles.pasteHint}>Press <kbd>Ctrl / ⌘</kbd> + <kbd>V</kbd> anywhere in this window, or <b>choose files</b></span><small>PNG, JPEG or WebP · up to 6 at once · 8 MB each</small></span>
            <input aria-label="Relic screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={!!busy} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value=''; void scan(files); }} />
          </label>
          {!rows.length && <p className={styles.uploadNote}>Keep each card’s name, stars and rating visible. Overlapping screenshots are fine. Uses your shared screenshot allowance.</p>}
          {busy && <div className={styles.progress} role="status"><span><Loader2 size={16} className="animate-spin" />{busy}</span>{progress && <progress aria-label="Screenshot processing" value={progress.completed} max={progress.total} />}</div>}
          {errors.map((error,index) => <p role="alert" key={index} className={styles.error}>{error}</p>)}
          {!!rows.length && <>
            <section id="relic-review-decisions" className={styles.section} aria-labelledby="relic-decision-heading">
              <div className={styles.sectionHeading}><div><h2 id="relic-decision-heading">Needs a choice <span>{review.decisions.length}</span></h2><p>Choose any unclear variant, then the matching rank and signature.</p></div></div>
              {review.decisions.length ? <div className={styles.cards}>{review.decisions.map(row => card(row))}</div> : <div className={styles.allDone}><Check size={18} />All build choices resolved.</div>}
            </section>
            {!!review.unmatched.length && <section id="relic-review-unmatched" className={styles.section} aria-labelledby="relic-unmatched-heading"><div className={styles.sectionHeading}><div><h2 id="relic-unmatched-heading">Needs manual entry <span>{review.unmatched.length}</span></h2><p>These cards will be left out of this import. Use Add relics to enter their in-game rank and signature.</p></div></div><div className={styles.cards}>{review.unmatched.map(row => card(row))}</div></section>}
            <section id="relic-review-ready" tabIndex={-1} className={styles.section} aria-labelledby="relic-ready-heading"><div className={styles.sectionHeading}><div><h2 id="relic-ready-heading"><Check size={17} />Ready to import <span>{review.ready.length}</span></h2><p>Review the matched builds. You can change or leave out any card.</p></div></div><div className={styles.readyCards}>{review.ready.map(row => card(row,true))}</div>{!review.ready.length && <p className={styles.empty}>Your selected builds will appear here.</p>}</section>
            {!!review.skipped.length && <details className={styles.skipped}><summary>Left out ({review.skipped.length})<ChevronDown size={15} /></summary>{review.skipped.map(row => <div key={row.id}><span>{row.name}<small>{row.rating.toLocaleString('en-US')} rating</small></span><button disabled={!!busy} onClick={() => patch(row.id,{skipped:false,included:row.choice !== null})}>Restore</button></div>)}</details>}
            <details className={styles.help}><summary>How are builds matched?<ChevronDown size={14} /></summary><p>Rank and signature matching assumes all unlocked runes are fully leveled for the current rank. Partially leveled runes change prestige, so add those relics manually using their in-game rank and signature. Even with maxed runes, a rating can match more than one build. If the identified relic exactly matches a build saved in your collection, we reuse its rank and signature. You can still change it. Statcast attribute icons identify the variant; unclear icons need your choice. Matching duplicates are saved once.</p></details>
          </>}
        </div>
        {!!rows.length && <footer className={styles.footer}>
          {conflict && <p role="alert" className={styles.error}>Some screenshots disagree on the same relic. Resolve the highlighted cards or leave one out.</p>}
          <div><span><strong>{review.uniqueCount} {review.uniqueCount === 1 ? 'relic' : 'relics'} selected</strong>{rows.length-review.selected.length} cards left out · matching duplicates saved once</span><button className={styles.save} disabled={!!busy || !review.selected.length || conflict || review.selected.length > 180} onClick={() => void save()}><Check size={16} />Save {review.uniqueCount} {review.uniqueCount === 1 ? 'relic' : 'relics'}</button></div>
        </footer>}
      </>}
    </DialogContent>
  </Dialog>;
}

function ReviewCard({row, compact, expanded, disabled, conflict, existing, attributeIcons, onChoose, onVariantChange, onLeaveOut, onEdit}: {
  attributeIcons: Record<string, RelicAttributeIcon>;
  row:RelicReviewRow; compact:boolean; expanded:boolean; disabled:boolean; conflict:boolean; existing?:OwnedRelic;
  onChoose:(choice:number) => void; onLeaveOut:() => void; onEdit:() => void;
  onVariantChange:(relicId:string) => void;
}) {
  const match = row.choice === null ? null : row.matches[row.choice];
  const hasVariantChoices = new Set(row.matches.map(option => option.relicId)).size > 1;
  return <article id={`review-card-${row.id}`} tabIndex={-1} aria-label={`${row.name} ${row.rating}`} className={`${styles.card} ${compact ? styles.compact : ''} ${conflict ? styles.conflict : ''} ${expanded ? styles.expanded : ''}`}>
    <div className={styles.cardOverview}>
      <RelicScreenshotPreview row={row} />
      <div className={styles.detail}><h3>{row.name}</h3>
        <p>{compact && match ? `${match.stars}★` : row.stars ? `${row.stars}★` : 'Rarity unclear'} · {row.className?.toLowerCase() ?? 'Class unclear'} · <strong>{row.rating.toLocaleString('en-US')}</strong></p>
        {compact && match ? <p className={styles.matchedBuild}><Check size={13} />Rank {match.rank}<span>Sig {match.sigLevel}</span></p> : <span className={styles.cardBadge}>{row.matches.length ? conflict ? 'Build conflict' : hasVariantChoices && !row.pendingVariantId ? 'Choose a variant' : 'Choose a build' : 'Build not matched'}</span>}
        {row.secondaryAttribute && <p className={styles.attribute}><RelicAttributeGlyph icon={attributeIcons[row.secondaryAttribute]} />{row.secondaryAttribute}</p>}
        {compact && match?.secondaryAttribute && !row.secondaryAttribute && <p className={styles.attribute}><RelicAttributeGlyph icon={attributeIcons[match.secondaryAttribute]} />{match.secondaryAttribute}</p>}
      </div>
      <div className={styles.cardActions}>{compact && <button disabled={disabled} aria-expanded={expanded} onClick={onEdit}>{expanded ? 'Done' : 'Change'}</button>}<button disabled={disabled} onClick={onLeaveOut} aria-label={`Leave out ${row.name} ${row.rating}`} title="Leave out">{compact ? <X size={15} /> : 'Leave out'}</button></div>
    </div>
    {(!compact || expanded) && <div className={styles.cardBody}>
      {conflict && <p className={styles.warning}>These screenshots select different builds for the same relic. Match the choices or leave one out.</p>}
      {row.attributeStatus === 'unclear' && !hasVariantChoices && <p className={styles.warning}>Check the detected attribute against the original card’s icons.</p>}
      {row.attributeStatus === 'conflict' && <p className={styles.warning}>The icon and relic family disagree. Try a clearer screenshot or add this relic manually.</p>}
      {row.matches.length ? <RelicScreenshotChoices matches={row.matches} choice={row.choice} attributeIcons={attributeIcons}
        disabled={disabled} showIdentity={!row.className} onChoose={onChoose} pendingVariantId={row.pendingVariantId ?? null} onVariantChange={onVariantChange} /> : <p className={styles.warning}>
        {row.attributeStatus === 'recognized'
          ? 'Relic and variant recognized, but rank and signature could not be matched. Matching assumes all unlocked runes are fully leveled for the current rank. If any runes are not maxed, use Add relics to enter the in-game rank and signature manually.'
          : 'No matching build was found. Check the screenshot details. Matching assumes fully leveled runes; if any unlocked runes are not maxed, use Add relics to enter the in-game rank and signature manually.'}
      </p>}
    </div>}
    {existing && <p className={styles.existing}>{match?.rank === existing.rank && match.sigLevel === existing.sigLevel
      ? row.selectionSource === 'collection' ? 'Matched your saved rank and signature.' : 'Already in your collection.'
      : `Updates your rank ${existing.rank}, sig ${existing.sigLevel} relic.`}</p>}
  </article>;
}
