"use client";
/* eslint-disable @next/next/no-img-element -- Native catalog images must bypass image optimization. */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDownToLine, ChevronLeft, ChevronRight, ImageIcon, Search, SlidersHorizontal, X } from "lucide-react";
import type { ArtworkCard, ArtworkDetail, ArtworkSearch } from "@/lib/game-artwork/contract";
import styles from "./artwork.module.css";

const filterKeys = ["q", "family", "evidence", "kind", "source", "category", "minWidth", "minHeight", "maxWidth", "maxHeight", "page", "pageSize"];
const basisLabels = { registry: "Registry use", "native-id": "Native ID", hint: "Usage hint", native: "Native alias" };
const familyLabels: Record<string,string> = { portraits:"Champions & portraits",crystals:"Crystals & banners",items:"Items & rewards",currencies:"Currencies",catalysts:"Catalysts & ISO",combat:"Effects & node UI",quests:"Quest & Tower",backgrounds:"Backgrounds",interface:"UI elements",materials:"Textures & VFX",unclassified:"Unclassified" };
function FacetSelect({ name, initialValue, options, emptyLabel }: { name: string; initialValue: string; options: string[]; emptyLabel: string }) {
  // The URL-keyed parent form remounts on navigation. Keep draft edits locally,
  // while controlling the value as asynchronously loaded facet options arrive.
  const [value, setValue] = useState(initialValue);
  return <select name={name} value={value} onChange={event => setValue(event.target.value)}>
    <option value="">{emptyLabel}</option>
    {value && !options.includes(value) && <option value={value}>{value}</option>}
    {options.map(option => <option key={option} value={option}>{option}</option>)}
  </select>;
}
function MatchInfo({asset}: {asset: ArtworkCard}) {
  return asset.match ? <span className={styles.match} data-basis={asset.match.basis} title={asset.match.label}>{basisLabels[asset.match.basis]} · {asset.match.label}</span> : asset.families?.length ? <span className={styles.match} data-basis="hint">{asset.families[0] === "unclassified" ? "Unclassified · native aliases only" : `Usage hint · ${asset.families.map(f=>familyLabels[f]).slice(0,2).join(" / ")}`}</span> : null;
}
function formatBytes(bytes: number) { return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }
async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The artwork library is temporarily unavailable.");
  return data;
}
function NativeImage({ id, original = false, name, zoom = "fit" }: { id: string; original?: boolean; name: string; zoom?: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  return <>
    {status === "loading" && <span className={styles.imageStatus} role="status">Loading image…</span>}
    {status === "error" ? <span className={styles.imageStatus}><ImageIcon size={22} /><span>Image unavailable</span>{original && <button onClick={() => { setStatus("loading"); setAttempt(n => n + 1); }}>Retry image</button>}</span> :
      <img key={attempt} src={`/api/game-artwork/${id}/${original ? "original" : "preview"}${attempt ? `?retry=${attempt}` : ""}`} alt={name} loading={original ? "eager" : "lazy"} decoding="async" onLoad={() => setStatus("ready")} onError={() => setStatus("error")}
        className={`${styles.nativeImage} ${original ? styles.original : ""}`} style={{ opacity: status === "ready" ? 1 : 0, ...(original && zoom !== "fit" ? { maxWidth: "none", maxHeight: "none", width: `${Number(zoom)}%` } : {}) }} />}
  </>;
}
function Facts({ asset }: { asset: ArtworkCard }) {
  return <span className={styles.facts}>{asset.width} × {asset.height}<span>·</span>{asset.format}<span>·</span>{asset.transparent ? "Alpha" : "Opaque"}</span>;
}
export function ArtworkBrowser() {
  const searchParams = useSearchParams();
  const query = new URLSearchParams();
  for (const key of filterKeys) for (const value of searchParams.getAll(key)) query.append(key, value);
  const queryString = query.toString();
  const selected = searchParams.get("asset");
  const [result, setResult] = useState<ArtworkSearch | null>(null);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [requestError, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const requestKey = `${queryString}|${retry}`;
  const loading = loadedRequest !== requestKey;
  const error = loading ? "" : requestError;
  const [advanced, setAdvanced] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const selectionPushed = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultsTitle = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);
  const focusSearch = useRef(false);
  const familyRail = useRef<HTMLElement>(null);
  const selectedFamily = searchParams.get("family") ?? "";
  useEffect(() => {
    const rail=familyRail.current;
    const active=rail?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (rail && active && rail.scrollWidth>rail.clientWidth) rail.scrollLeft=Math.max(0,active.offsetLeft-rail.offsetLeft-8);
  }, [selectedFamily, result?.families]);
  function navigate(params: URLSearchParams, replace = false) {
    const url = `/assets${params.size ? `?${params}` : ""}`;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
  }
  function resetSearch() { focusSearch.current = true; setAdvanced(false); navigate(new URLSearchParams()); }
  useEffect(() => {
    if (focusSearch.current) { searchInput.current?.focus(); focusSearch.current = false; }
  }, [queryString]);
  useEffect(() => {
    const controller = new AbortController();
    readJson<ArtworkSearch>(`/api/game-artwork${queryString ? `?${queryString}` : ""}`, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setResult(data); setError(""); setLoadedRequest(`${queryString}|${retry}`);
      if (focusResults.current) { resultsTitle.current?.focus(); focusResults.current = false; }
      const params = new URLSearchParams(window.location.search);
      if (params.has("page") && params.get("page") !== String(data.page)) {
        if (data.page === 1) params.delete("page"); else params.set("page", String(data.page));
        window.history.replaceState(null, "", `/assets?${params}`);
      }
    }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoadedRequest(`${queryString}|${retry}`); } });
    return () => controller.abort();
  }, [queryString, retry]);
  const filtered = filterKeys.some(key => key !== "page" && searchParams.has(key));
  const advancedCount = ["evidence", "source", "category", "minWidth", "minHeight", "maxWidth", "maxHeight"].filter(key => searchParams.get(key)).length;
  function closeInspector() {
    if (selectionPushed.current) { selectionPushed.current = false; window.history.back(); }
    else { const params = new URLSearchParams(searchParams.toString()); params.delete("asset"); navigate(params, true); }
  }
  return <div className={styles.library}>
    <header className={styles.heading}><div><p className={styles.eyebrow}><ImageIcon size={15} /> GAME ARTWORK</p><h1>Asset library</h1><p className={styles.subtitle}>Find game art by friendly name, native alias or use. Inspect the original pixels.</p></div><span className={styles.countBadge}>{result ? result.libraryTotal.toLocaleString("en-US") : "—"} assets</span></header>
    {result?.families && <nav ref={familyRail} className={styles.families} aria-label="Browse artwork families">
      <button aria-pressed={!searchParams.get("family")} onClick={()=>{const params=new URLSearchParams(searchParams.toString());params.delete("family");params.delete("page");navigate(params);}}>All artwork <span>{result.libraryTotal.toLocaleString("en-US")}</span></button>
      {result.families.map(family=><button key={family.id} aria-pressed={searchParams.get("family")===family.id} onClick={()=>{const params=new URLSearchParams(searchParams.toString());params.set("family",family.id);params.delete("page");focusResults.current=true;navigate(params);}}>{family.label} <span>{family.count.toLocaleString("en-US")}</span></button>)}
    </nav>}
    {result?.discovery?.status === "ready" && <details className={styles.coverage}><summary>About matches & coverage</summary><p>Distinct assets; families overlap. {result.discovery.coverage?.registry} registry-linked / {result.discovery.coverage?.nativeId} assets with native champion IDs / {result.discovery.coverage?.unclassified.toLocaleString("en-US")} unclassified. <span>Usage hints do not verify identity. Some effect icons are font glyphs with no verified PNG mapping.</span></p></details>}
    {result?.discovery?.status === "unavailable" && <p className={styles.coverage}>Discovery metadata is unavailable. Native alias browsing remains available.</p>}
    <form key={queryString} className={styles.searchForm} onSubmit={event => {
      event.preventDefault(); const params = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => { if (String(value).trim()) params.set(key, String(value).trim()); });
      focusResults.current = true; navigate(params);
    }}>
      <input type="hidden" name="family" value={searchParams.get("family") ?? ""} />
      <div className={styles.searchRow}><label className={styles.searchField}><Search size={19} /><span className={styles.srOnly}>Search names, identities and paths</span><input ref={searchInput} name="q" defaultValue={searchParams.get("q") ?? ""} maxLength={160} placeholder="Search champion, item or native name…" type="search" /></label><button type="submit" className={styles.primary}>Search</button></div>
      <div className={styles.kindRow}><button type="button" className={styles.filterToggle} aria-expanded={advanced} aria-controls="artwork-filters" onClick={() => setAdvanced(v => !v)}><SlidersHorizontal size={17} /><span>Filters{advancedCount ? ` (${advancedCount})` : ""}</span></button><label>Kind<select name="kind" defaultValue={searchParams.get("kind") ?? ""}><option value="">All kinds</option><option value="texture">Texture</option><option value="sprite">Sprite</option><option value="loose">Loose image</option></select></label><span className={styles.searchHint}>Friendly names, native aliases and paths. One card per asset.</span>{(filtered || searchParams.has("page")) && <button type="button" className={styles.reset} onClick={resetSearch}>Reset all</button>}</div>
      <div id="artwork-filters" hidden={!advanced}>
        <div className={styles.advancedGrid}><label>Evidence<select name="evidence" defaultValue={searchParams.get("evidence") ?? ""}><option value="">Any evidence</option><option value="registry">Exact registry use</option><option value="native-id">Native champion ID</option><option value="hint">Hints / unclassified only</option></select></label><label>Source<FacetSelect name="source" initialValue={searchParams.get("source") ?? ""} options={result?.sources ?? []} emptyLabel="All sources" /></label><label>Path category<FacetSelect name="category" initialValue={searchParams.get("category") ?? ""} options={result?.categories ?? []} emptyLabel="All categories" /></label>
          <fieldset><legend>Native width (px)</legend><div className={styles.range}>{["minWidth", "maxWidth"].map((key, i) => <label key={key}><span className={styles.srOnly}>{i ? "Maximum width" : "Minimum width"}</span><input name={key} type="number" min={i ? 1 : 0} max={32768} placeholder={i ? "Max" : "Min"} defaultValue={searchParams.get(key) ?? ""} /></label>)}</div></fieldset>
          <fieldset><legend>Native height (px)</legend><div className={styles.range}>{["minHeight", "maxHeight"].map((key, i) => <label key={key}><span className={styles.srOnly}>{i ? "Maximum height" : "Minimum height"}</span><input name={key} type="number" min={i ? 1 : 0} max={32768} placeholder={i ? "Max" : "Min"} defaultValue={searchParams.get(key) ?? ""} /></label>)}</div></fieldset></div>
        <p className={styles.categoryNote}>Path categories preserve extractor provenance. Browse families add registry links and labelled usage hints. <button className={styles.inlineApply} type="submit">Apply filters →</button></p>
      </div>
    </form>
    <section aria-labelledby="artwork-results" aria-busy={loading}>
      <div className={styles.resultsBar}><h2 id="artwork-results" tabIndex={-1} ref={resultsTitle}>{loading ? "Searching…" : error ? "Library unavailable" : `${selectedFamily ? `${familyLabels[selectedFamily]}: ` : ""}${result?.total.toLocaleString("en-US")} ${filtered ? result?.total === 1 ? "match" : "matches" : "assets"}`}</h2>{result && !error && <span>{result.total ? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)}` : "0"} of {result.total.toLocaleString("en-US")}</span>}</div>
      <div className={styles.srOnly} role="status">{!loading && (error || `${result?.total} assets found. Page ${result?.page}.`)}</div>
      {error ? <div className={styles.empty}><ImageIcon /><h3>Artwork is unavailable</h3><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>Try again</button><button onClick={() => navigate(new URLSearchParams())}>Clear search</button></div> : !loading && result?.total === 0 ? <div className={styles.empty}><Search /><h3>No matching artwork</h3><p>Try a shorter native name or relax the source and dimension filters.</p><button className={styles.primary} onClick={resetSearch}>Reset all filters</button></div> :
        <div className={styles.gallery} style={{ opacity: loading ? 0.5 : 1 }}>{result?.items.map(asset => <button key={asset.id} className={styles.card} onClick={event => {
          opener.current = event.currentTarget; selectionPushed.current = true;
          const params = new URLSearchParams(searchParams.toString()); params.set("asset", asset.id); navigate(params);
        }} aria-label={`Inspect ${asset.displayName || asset.name}, ${asset.width} by ${asset.height}, ${asset.kind}`}><span className={styles.thumbnail}><NativeImage id={asset.id} name={asset.name} /><span className={styles.kind}>{asset.kind === "loose" ? "image" : asset.kind}</span></span><span className={styles.cardInfo}><strong title={asset.displayName || asset.name}>{asset.displayName || asset.name}</strong>{asset.displayName && asset.displayName !== asset.name && <small className={styles.nativeName} title={asset.name}>{asset.name}</small>}<Facts asset={asset} /><MatchInfo asset={asset} /></span></button>)}</div>}
      {result && result.total > 0 && !error && <nav className={styles.pagination} aria-label="Asset pages"><button disabled={loading || result.page === 1} onClick={() => { const params = new URLSearchParams(searchParams.toString()); params.set("page", String(result.page - 1)); focusResults.current = true; navigate(params); }}><ChevronLeft size={16} /> Previous</button><span>Page {result.page} of {Math.ceil(result.total / result.pageSize)}</span><button disabled={loading || result.page * result.pageSize >= result.total} onClick={() => { const params = new URLSearchParams(searchParams.toString()); params.set("page", String(result.page + 1)); focusResults.current = true; navigate(params); }} >Next <ChevronRight size={16} /></button></nav>}
    </section>
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) closeInspector(); }}><Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.inspector} onCloseAutoFocus={event => { event.preventDefault(); (opener.current?.isConnected ? opener.current : searchInput.current)?.focus(); }}>
      <Dialog.Close className={styles.close} aria-label="Close inspector"><X size={21} /></Dialog.Close>
      {selected && <Inspector key={selected} id={selected} match={result?.items.find(item=>item.id===selected)?.match} />}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
function Inspector({ id, match }: { id: string; match?: ArtworkCard["match"] }) {
  const [asset, setAsset] = useState<ArtworkDetail | null>(null);
  const [error, setError] = useState("");
  const [background, setBackground] = useState("checker");
  const [zoom, setZoom] = useState("fit");
  useEffect(() => {
    const controller = new AbortController();
    readJson<ArtworkDetail>(`/api/game-artwork/${encodeURIComponent(id)}`, controller.signal).then(setAsset).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id]);
  return <>
    <div className={styles.inspectorHeading}><p className={styles.eyebrow}>{asset?.kind === "loose" ? "LOOSE IMAGE" : asset?.kind.toUpperCase() || "ASSET"}</p><Dialog.Title>{match && ["registry","native-id"].includes(match.basis) ? match.label : asset?.displayName || asset?.name || (error ? "Asset unavailable" : "Loading asset…")}</Dialog.Title><Dialog.Description>{asset ? <Facts asset={asset} /> : error || "Reading catalog details…"}</Dialog.Description></div>
    {asset && <>{asset.displayName !== asset.name && <p className={styles.nativeName}>{asset.name}</p>}{match && <MatchInfo asset={{...asset,match}} />}<div className={styles.inspectorFamilies}>{asset.families?.map(f=><span key={f}>{familyLabels[f]}</span>)}</div><div className={styles.previewToolbar}><div role="group" aria-label="Preview background">{["checker", "light", "dark"].map(value => <button key={value} aria-pressed={background === value} onClick={() => setBackground(value)}>{value === "checker" ? "Checkerboard" : value === "light" ? "Light" : "Dark"}</button>)}</div><label>Zoom<select value={zoom} onChange={event => setZoom(event.target.value)}><option value="fit">Fit · no upscale</option><option value="100">100% · native</option><option value="200">200%</option></select></label></div>
      <div className={`${styles.previewStage} ${styles[background]}`}><div className={zoom === "fit" ? styles.fitCanvas : styles.zoomCanvas} style={zoom !== "fit" ? { width: asset.width * Number(zoom) / 100, minHeight: asset.height * Number(zoom) / 100 } : undefined}><NativeImage id={id} original name={asset.name} zoom={zoom === "fit" ? "fit" : "100"} /></div></div>
      <div className={styles.downloadRow}><p>{formatBytes(asset.bytes)} · {asset.kind === "loose" ? "Original encoding" : "Native decoded PNG"}</p><a href={`/api/game-artwork/${id}/original?download=1`} download className={styles.primary}><ArrowDownToLine size={16} />Download original</a></div>
      <details className={styles.provenance}><summary>Discovery, source evidence & hashes <span>{asset.aliasCount} aliases</span></summary><p>Registry use links are exact byte/reference joins. Native IDs match canonical champion IDs; usage hints are lexical, not verified identities. {asset.aliasCount > asset.aliases.length ? `Showing the first ${asset.aliases.length} aliases.` : ""}</p>{asset.identities && asset.identities.length>0 && <div className={styles.identityEvidence}><h3>Identity & artwork-use evidence ({asset.identityCount})</h3>{asset.identities.map((identity,i)=><div key={i}><strong>{identity.label}</strong><p>{basisLabels[identity.basis]} / {identity.domain} / {identity.id}</p><p>{identity.note}</p><code>{identity.reference}</code><small>Artwork binding: {identity.source}<br />Name: {identity.labelSource || identity.source}</small></div>)}{(asset.identityCount ?? 0)>asset.identities.length && <p>Showing the first {asset.identities.length} links.</p>}</div>}{asset.hints && <p>Usage hints: {asset.hints.map(h=>`${familyLabels[h.family]} (${h.rule})`).join("; ")}</p>}<dl><dt>Asset ID</dt><dd>{asset.id}</dd><dt>RGBA pixel SHA-256</dt><dd>{asset.pixelSha256}</dd><dt>Original byte SHA-256</dt><dd>{asset.blobSha256}</dd></dl>{asset.aliases.map((alias, i) => <div className={styles.alias} key={`${alias.objectId}-${i}`}><strong>{alias.name}</strong><p>{alias.source} / {alias.sourcePath}</p><p>{alias.path}</p><small>{alias.category} · {alias.evidence}</small><dl><dt>Source SHA-256</dt><dd>{alias.sourceSha256}</dd></dl></div>)}</details>
    </>}
    {error && <p className={styles.inspectorError}>Close this inspector to continue browsing. A saved link may refer to an asset that is no longer available.</p>}
  </>;
}
