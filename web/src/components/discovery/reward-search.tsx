"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowRight, CornerDownLeft, Gem, Search, X } from "lucide-react";
import { rankRewardSearchOptions, rewardSearchLabel, type RewardSearchOption } from "./reward-search-ranking";
import styles from "./reward-search.module.css";

export type { RewardSearchOption } from "./reward-search-ranking";

export function RewardSearch({ options, initialQuery }: { options: RewardSearchOption[]; initialQuery: string }) {
  const router = useRouter();
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState({ initialQuery, query: initialQuery, open: false, active: -1 });
  // A server navigation may reuse the client component with a different query.
  // Reset it together, so a stale option can never be selected for the new query.
  if (state.initialQuery !== initialQuery) setState({ initialQuery, query: initialQuery, open: false, active: -1 });
  const { query, open, active } = state;
  const matches = useMemo(() => rankRewardSearchOptions(options, query), [options, query]);
  const expanded = open && Boolean(query.trim());
  const listId = `${id}-suggestions`, statusId = `${id}-status`, hintId = `${id}-hint`;
  const activeId = expanded && matches[active] ? `${id}-option-${active}` : undefined;
  const dismiss = () => setState(current => ({ ...current, open: false, active: -1 }));

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) {
        setState(current => current.open ? { ...current, open: false, active: -1 } : current);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setState(current => ({ ...current, open: true, active: matches.length
        ? event.key === "ArrowDown" ? (current.active + 1) % matches.length : current.active <= 0 ? matches.length - 1 : current.active - 1
        : -1 }));
    } else if (event.key === "Enter" && expanded && matches[active]) {
      event.preventDefault();
      router.push(matches[active].href);
      dismiss();
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape" && expanded) event.preventDefault();
      dismiss();
    }
  };

  const select = (event: MouseEvent<HTMLAnchorElement>, option: RewardSearchOption) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    router.push(option.href);
    dismiss();
  };

  return <div ref={wrapper} className={styles.lookup} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dismiss();
  }}>
    <form action="/rewards" method="get" className={styles.form}>
      <label htmlFor={id} className={styles.label}>Reward name</label>
      <div className={styles.controlArea}>
      <div className={styles.controls}>
        <div className={styles.field}>
          <Search size={20} aria-hidden="true" className={styles.searchIcon}/>
          <input ref={input} id={id} type="search" name="q" value={query} maxLength={180} role="combobox"
            autoComplete="off" spellCheck={false} placeholder="Search crystals, catalysts, gems…"
            aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
            aria-activedescendant={activeId} aria-describedby={expanded ? `${hintId} ${statusId}` : hintId}
            onFocus={() => setState(current => ({ ...current, open: true }))}
            onClick={() => setState(current => ({ ...current, open: true }))}
            onChange={event => setState(current => ({ ...current, query: event.target.value, open: true, active: -1 }))}
            onKeyDown={handleKeyDown}/>
          {query && <button type="button" className={styles.clear} aria-label="Clear reward search" onClick={() => {
            setState(current => ({ ...current, query: "", active: -1, open: false })); input.current?.focus();
          }}><X size={17} aria-hidden="true"/></button>}
        </div>
        <button type="submit" className={styles.submit}><span>Search</span><ArrowRight size={17} aria-hidden="true"/></button>
      </div>
    {expanded && <div className={styles.popup}>
      <p id={statusId} role="status" className={styles.status}>{matches.length
        ? `${matches.length} suggestions${matches.length === 7 ? " shown" : ""}. Use ↑ ↓ to choose.`
        : "No matching rewards. Try a different name or a broader search."}</p>
      <ul id={listId} role="listbox" aria-label="Matching rewards" className={styles.list}>
        {matches.map((option, index) => <li role="presentation" key={option.key}>
          <a id={`${id}-option-${index}`} href={option.href} role="option" aria-selected={active === index} tabIndex={-1}
            className={styles.option} onMouseEnter={() => setState(current => ({ ...current, active: index }))}
            onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()} onClick={event => select(event, option)}>
            <span className={styles.art}>{option.imageUrl ? <Image src={option.imageUrl} width={36} height={36} sizes="36px" alt=""/> : <Gem size={23} aria-hidden="true"/>}</span>
            <span className={styles.copy}><span className={styles.name}>{rewardSearchLabel(option)}</span><span className={styles.sources}>{option.sources.toLocaleString("en")} {option.sources === 1 ? "source" : "sources"}</span></span>
            <ArrowRight size={16} aria-hidden="true" className={styles.optionArrow}/>
          </a>
        </li>)}
      </ul>
      {matches.length > 0 && <div className={styles.footer}><CornerDownLeft size={13} aria-hidden="true"/><span>{activeId ? "Enter opens the selected reward" : "Enter searches all matching rewards"}</span></div>}
    </div>}
      </div>
      <p id={hintId} className={styles.hint}>Choose a suggestion to see its sources, or search to browse matching rewards.</p>
    </form>
  </div>;
}
