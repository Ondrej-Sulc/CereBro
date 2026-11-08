"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Search } from "lucide-react";
import Fuse from "fuse.js";
import type { ChampionLookupOption } from "@/lib/data/champion-lookup";
import styles from "./home-champion-search.module.css";

function isLookupOptions(value: unknown): value is ChampionLookupOption[] {
  return Array.isArray(value) && value.every(option => option && typeof option === "object"
    && typeof option.name === "string" && !!option.name.trim()
    && typeof option.slug === "string" && !!option.slug.trim());
}

export function HomeChampionSearch() {
  const id = useId();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [champions, setChampions] = useState<ChampionLookupOption[]>([]);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const loaded = useRef(false);
  const loading = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const loadChampions = async () => {
    if (loaded.current || loading.current) return;
    loading.current = true;
    request.current = new AbortController();
    setStatus("loading");
    try {
      const response = await fetch("/api/champions/lookup", { signal: request.current.signal });
      if (!response.ok) throw new Error("Lookup unavailable");
      const data: unknown = await response.json();
      if (!isLookupOptions(data)) throw new Error("Invalid lookup response");
      setChampions(data);
      loaded.current = true;
      setStatus("ready");
    } catch {
      if (!request.current?.signal.aborted) setStatus("error");
    } finally {
      loading.current = false;
    }
  };

  // Match the established ChampionCombobox's tolerant name search without its
  // full champion/image/virtualized-list dependencies.
  const fuse = useMemo(() => new Fuse(champions, {
    keys: ["name"], threshold: 0.3, distance: 100, ignoreLocation: true,
  }), [champions]);
  const matches = useMemo(() => query.trim() ? fuse.search(query.trim()).map(result => result.item).slice(0, 6) : [], [fuse, query]);
  const href = (champion: ChampionLookupOption) => `/champions/${encodeURIComponent(champion.slug)}`;
  const listId = `${id}-results`;
  const statusId = `${id}-status`;
  const activeId = open && active >= 0 && matches[active] ? `${id}-option-${active}` : undefined;

  useEffect(() => {
    if (!activeId) return;
    listRef.current?.querySelector<HTMLElement>(`[id="${activeId}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      void loadChampions();
      if (matches.length) setActive(current => event.key === "ArrowDown"
        ? (current + 1) % matches.length
        : current <= 0 ? matches.length - 1 : current - 1);
    } else if (event.key === "Enter" && open && matches.length) {
      event.preventDefault();
      router.push(href(matches[active >= 0 ? active : 0]));
      setOpen(false);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (event.key === "Tab") {
      setOpen(false);
      setActive(-1);
    }
  };

  const message = status === "loading" ? "Loading champion names…"
    : status === "error" ? "Champion search is unavailable."
    : !champions.length && status === "ready" ? "No champion pages available. Browse the catalog below."
    : !query.trim() ? "Type a name to open a champion page."
    : !matches.length ? "No champions match. Try another name."
    : `${matches.length} ${matches.length === 1 ? "match" : "matches"}${matches.length === 6 ? " shown" : ""}. Use arrow keys to choose.`;

  return (
    <div className={styles.lookup} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <label htmlFor={id}>Search champion pages</label>
      <div className={styles.field}>
        <Search aria-hidden="true" />
        <input ref={inputRef} id={id} type="text" role="combobox" autoComplete="off" spellCheck={false}
          placeholder="Enter a champion name" value={query} aria-autocomplete="list" aria-expanded={open}
          aria-controls={listId} aria-activedescendant={activeId} aria-describedby={open ? statusId : undefined}
          onFocus={() => { setOpen(true); void loadChampions(); }}
          onClick={() => { setOpen(true); void loadChampions(); }}
          onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); void loadChampions(); }}
          onKeyDown={handleKeyDown} />
        {status === "loading" && <Loader2 aria-hidden="true" className={styles.spinner} />}
      </div>
      {open && <div className={styles.popup}>
        <p id={statusId} role="status" className={styles.status}>{message}</p>
        {status === "error" && <button type="button" className={styles.retry} onClick={() => { inputRef.current?.focus(); void loadChampions(); }}>Try again</button>}
        <ul id={listId} role="listbox" aria-label="Champion pages" ref={listRef}>
          {status === "ready" && matches.map((champion, index) => <li role="presentation" key={champion.slug}>
            <a id={`${id}-option-${index}`} href={href(champion)} role="option" aria-selected={active === index} tabIndex={-1}
              onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)}>
              <span>{champion.name}</span><ArrowUpRight aria-hidden="true" />
            </a>
          </li>)}
        </ul>
      </div>}
    </div>
  );
}
