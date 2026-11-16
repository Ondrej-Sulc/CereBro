'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowRight, CornerDownLeft, Search, Sparkles, X } from 'lucide-react';
import { glossaryHref } from '@/lib/glossary-navigation';
import { rankGlossarySearchOptions, type GlossarySearchOption } from '@/lib/glossary-search';
import styles from './glossary-search-form.module.css';

function SearchIcon({ option }: { option: GlossarySearchOption }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={styles.icon} aria-hidden="true" style={{ '--effect-color': option.color, '--effect-secondary': option.secondaryColor } as CSSProperties}>
    {option.iconUrl && failed !== option.iconUrl ? <Image unoptimized src={option.iconUrl} width={28} height={28} alt="" onError={() => setFailed(option.iconUrl)}/> : <Sparkles size={23}/>}
  </span>;
}

export function GlossarySearchForm({ options, initialQuery, categoryId, returnTo, clearHref, className }: {
  options: GlossarySearchOption[]; initialQuery: string; categoryId: number | null; returnTo: string; clearHref: string; className?: string;
}) {
  const router = useRouter();
  const urlQuery = useSearchParams()?.toString() ?? '';
  const id = useId(), input = useRef<HTMLInputElement>(null), wrapper = useRef<HTMLDivElement>(null);
  const context = `${initialQuery}\0${categoryId ?? ''}\0${returnTo}`;
  const [state, setState] = useState({ context, query: initialQuery, open: false, active: -1 });
  if (state.context !== context) setState({ context, query: initialQuery, open: false, active: -1 });
  const { query, open, active } = state;
  const scopedOptions = useMemo(() => categoryId === null ? options : options.filter(option => option.categories.some(category => category.id === categoryId)), [options, categoryId]);
  const matches = useMemo(() => rankGlossarySearchOptions(scopedOptions, query), [scopedOptions, query]);
  const expanded = open && Boolean(query.trim());
  const listId = `${id}-options`, statusId = `${id}-status`, hintId = `${id}-hint`;
  const activeId = expanded && matches[active] ? `${id}-option-${active}` : undefined;
  const dismiss = () => setState(current => ({ ...current, open: false, active: -1 }));

  useEffect(() => {
    // Browser history may restore an edited input after the URL has been restored.
    const sync = () => setState(current => ({ ...current, query: (new URLSearchParams(window.location.search).get('q') ?? '').trim().slice(0, 100), open: false, active: -1 }));
    let frame = 0;
    const restored = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); };
    sync(); window.addEventListener('pageshow', restored); window.addEventListener('popstate', restored);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pageshow', restored); window.removeEventListener('popstate', restored); };
  }, [urlQuery]);

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setState(current => ({ ...current, open: false, active: -1 })); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => { if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' }); }, [activeId]);

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) { if (event.key === 'Enter') event.preventDefault(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setState(current => ({ ...current, open: true, active: matches.length ? event.key === 'ArrowDown'
        ? (current.active + 1) % matches.length : current.active <= 0 ? matches.length - 1 : current.active - 1 : -1 }));
    } else if (event.key === 'Enter' && expanded && matches[active]) {
      event.preventDefault(); router.push(glossaryHref(matches[active].id, returnTo)); dismiss();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape' && expanded) event.preventDefault(); dismiss();
    }
  };
  const select = (event: MouseEvent<HTMLAnchorElement>, option: GlossarySearchOption) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault(); router.push(glossaryHref(option.id, returnTo)); dismiss();
  };

  return <div ref={wrapper} className={`${styles.lookup}${className ? ` ${className}` : ''}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dismiss(); }}>
    <form action="/glossary#effects-results" method="get" className={styles.form} role="search" aria-label="Search effects">
      {categoryId !== null && <input type="hidden" name="category" value={categoryId}/>}
      <label htmlFor={id} className={styles.srOnly}>Search effects</label>
      <div className={styles.controlArea}>
        <div className={styles.controls}>
          <div className={styles.field}>
            <Search size={19} className={styles.searchIcon} aria-hidden="true"/>
            <input id={id} ref={input} name="q" type="search" role="combobox" value={query} maxLength={100} autoComplete="off" spellCheck={false}
              placeholder={categoryId !== null ? 'Search within this category…' : 'Search all effects…'} aria-autocomplete="list" aria-expanded={expanded}
              aria-controls={expanded ? listId : undefined} aria-activedescendant={activeId} aria-describedby={expanded ? `${hintId} ${statusId}` : hintId}
              onChange={event => setState(current => ({ ...current, query: event.target.value, open: true, active: -1 }))}
              onFocus={() => setState(current => ({ ...current, open: true }))} onClick={() => setState(current => ({ ...current, open: true }))} onKeyDown={keyDown}/>
            {query && <button type="button" aria-label="Clear effect search" className={styles.clearInput} onClick={() => { setState(current => ({ ...current, query: '', open: false, active: -1 })); input.current?.focus(); }}><X size={17} aria-hidden="true"/></button>}
          </div>
          <button type="submit" aria-label="Search effects" className={styles.submit}><span>Search</span><ArrowRight size={18} aria-hidden="true"/></button>
        </div>
        {expanded && <div className={styles.popup}>
          <p id={statusId} role="status" className={styles.status}>{matches.length ? `${matches.length} suggestions${matches.length === 7 ? ' shown' : ''}. Use ↑ ↓ to choose.` : 'No matching effects. Try a shorter name or another search.'}</p>
          <ul id={listId} role="listbox" aria-label="Matching effects" className={styles.list}>
            {matches.map((option, index) => <li role="presentation" key={option.id}>
              <a id={`${id}-option-${index}`} href={glossaryHref(option.id, returnTo)} role="option" aria-selected={active === index} tabIndex={-1} className={styles.option}
                onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setState(current => ({ ...current, active: index }))} onClick={event => select(event, option)}>
                <SearchIcon option={option}/><span className={styles.copy}><span className={styles.name}>{option.name}</span><span className={styles.description}>{option.description || 'Definition not recorded'}</span>{option.categories.length > 0 && <span className={styles.category}>{option.categories.slice(0, 2).map(category => category.name).join(' · ')}</span>}</span><ArrowRight size={16} className={styles.optionArrow} aria-hidden="true"/>
              </a>
            </li>)}
          </ul>
          {matches.length > 0 && <p className={styles.footer}><CornerDownLeft size={13} aria-hidden="true"/>{activeId ? 'Enter opens the selected effect' : 'Enter searches all matching effects'}</p>}
        </div>}
      </div>
      <div className={styles.help}><p id={hintId}>Choose an effect to view its sources, or search names and definitions.</p>{initialQuery && <Link prefetch={false} href={clearHref}>Clear search</Link>}</div>
    </form>
  </div>;
}
