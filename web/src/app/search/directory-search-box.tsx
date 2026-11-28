"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Search, Shield, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDebounce } from "@/hooks/use-debounce";
import { directorySearchHref } from "@/lib/directory-search";
import { cn } from "@/lib/utils";

type Suggestions = {
  players: Array<{
    id: string;
    ingameName: string;
    avatar: string | null;
    championPrestige: number | null;
    alliance: { name: string; tag: string | null } | null;
  }>;
  alliances: Array<{
    id: string;
    name: string;
    tag: string | null;
    inviteOnly: boolean;
    _count: { members: number };
  }>;
};
type SuggestionResponse = { query: string; data: Suggestions | null };
type Suggestion = { key: string; href: string; name: string; detail: string; icon: ReactNode; metadata?: ReactNode };

const desktopSuggestions = "(min-width: 640px)";

function subscribeToWidth(notify: () => void) {
  const media = window.matchMedia(desktopSuggestions);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

export function DirectorySearchBox({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const listId = useId();
  const container = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [response, setResponse] = useState<SuggestionResponse | null>(null);
  const wide = useSyncExternalStore(subscribeToWidth, () => window.matchMedia(desktopSuggestions).matches, () => false);
  const term = value.trim();
  const debouncedTerm = useDebounce(term, 250);
  const showSuggestions = open && term.length >= 2;
  const currentResponse = response?.query === term ? response : null;
  const limit = wide ? 3 : 2;

  function dismiss() {
    setOpen(false);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (!open || debouncedTerm.length < 2) return;
    const controller = new AbortController();
    fetch(`/api/search/directory?q=${encodeURIComponent(debouncedTerm)}`, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error("Search failed");
        return await res.json() as Suggestions;
      })
      .then(data => {
        if (!controller.signal.aborted) setResponse({ query: debouncedTerm, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResponse({ query: debouncedTerm, data: null });
      });
    return () => controller.abort();
  }, [debouncedTerm, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const players: Suggestion[] = (currentResponse?.data?.players ?? []).slice(0, limit).map(player => ({
    key: "player-" + player.id,
    href: "/player/" + player.id,
    name: player.ingameName,
    detail: player.alliance ? (player.alliance.tag ? `[${player.alliance.tag}] ` : "") + player.alliance.name : "Unaffiliated",
    icon: <Avatar className="size-8 shrink-0 rounded-lg border border-slate-700">
      <AvatarImage src={player.avatar ?? undefined} alt="" />
      <AvatarFallback className="rounded-lg bg-slate-800 text-[11px] font-semibold text-indigo-100">{player.ingameName.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>,
    metadata: player.championPrestige != null && <span className="text-[11px] tabular-nums text-slate-300">
      {player.championPrestige.toLocaleString("en-US")}<span className="sr-only"> prestige</span>
    </span>,
  }));
  const alliances: Suggestion[] = (currentResponse?.data?.alliances ?? []).slice(0, limit).map(alliance => ({
    key: "alliance-" + alliance.id,
    href: "/alliance/" + alliance.id,
    name: alliance.name,
    detail: `${alliance.tag ? `[${alliance.tag}] · ` : ""}${alliance._count.members.toLocaleString("en-US")} ${alliance._count.members === 1 ? "member" : "members"}`,
    icon: <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"><Shield className="size-4" /></span>,
    metadata: <span className={cn("text-[11px]", alliance.inviteOnly ? "text-amber-300" : "text-emerald-300")}>{alliance.inviteOnly ? "Invite only" : "Open"}</span>,
  }));
  const choices = [...players, ...alliances];
  const optionId = (item: Suggestion) => `${listId}-${item.key}`;
  const active = showSuggestions ? choices[activeIndex] : undefined;
  const activeId = active ? optionId(active) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function navigate(href: string) {
    dismiss();
    router.push(href);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(directorySearchHref(term));
  }

  function group(title: string, items: Suggestion[], icon: ReactNode, start: number) {
    if (!items.length) return null;
    return (
      <div role="group" aria-label={title} className="min-w-0">
        <p className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-400">{icon}{title}</p>
        {items.map((item, index) => (
          <button
            type="button"
            tabIndex={-1}
            key={item.key}
            id={optionId(item)}
            role="option"
            aria-selected={active?.key === item.key}
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(start + index)}
            onClick={() => navigate(item.href)}
            className={cn(
              "flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1 text-left",
              active?.key === item.key ? "bg-indigo-400/15" : "hover:bg-slate-800",
            )}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-100" title={item.name}><Match name={item.name} term={term} /></span>
              <span className="block truncate text-xs text-slate-400" title={item.detail}>{item.detail}</span>
            </span>
            {item.metadata && <span className="shrink-0 whitespace-nowrap">{item.metadata}</span>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form
      ref={container}
      role="search"
      aria-label="Directory search"
      onSubmit={submit}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) dismiss(); }}
      className="relative flex items-center gap-1 rounded-xl border border-slate-600 bg-slate-900 p-1.5 text-left focus-within:border-indigo-400 sm:gap-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-1.5 sm:pl-3">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          aria-label="Search players and alliances"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined}
          aria-activedescendant={activeId}
          autoComplete="off"
          placeholder="Player name, alliance name or tag"
          value={value}
          onChange={event => {
            setValue(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => { if (term !== initialValue || currentResponse) setOpen(true); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              dismiss();
              return;
            }
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && choices.length > 0) {
              event.preventDefault();
              setOpen(true);
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActiveIndex(index => index < 0 || index >= choices.length
                ? step === 1 ? 0 : choices.length - 1
                : (index + step + choices.length) % choices.length);
            } else if (event.key === "Enter" && active) {
              event.preventDefault();
              navigate(active.href);
            }
          }}
          className="min-h-11 w-full min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden sm:text-base"
        />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => {
            setValue("");
            setResponse(null);
            navigate(directorySearchHref());
          }} className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <button type="submit" className="min-h-11 rounded-lg bg-indigo-500 px-2.5 text-sm font-semibold text-white hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-4">Search</button>

      {showSuggestions && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
          <div id={listId} role="listbox" aria-label="Directory suggestions" className={cn(
            "grid max-h-[min(17rem,44dvh)] gap-2 overflow-y-auto p-1.5",
            players.length > 0 && alliances.length > 0 && "divide-y divide-slate-700/75 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:[&>div+div]:pl-2",
          )}>
            {group("Players", players, <Users className="size-3.5" aria-hidden="true" />, 0)}
            {group("Alliances", alliances, <Shield className="size-3.5" aria-hidden="true" />, players.length)}
          </div>
          {!choices.length && <p className="px-3 pb-2 text-xs text-slate-400" role="status">
            {!currentResponse ? "Searching…" : currentResponse.data ? "No suggestions found." : "Couldn’t load suggestions."}
          </p>}
          <button type="submit" className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-slate-700 bg-slate-800/65 px-3 text-left text-sm font-medium text-indigo-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300">
            <span className="min-w-0 break-all">See all results for “{term}”</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}
    </form>
  );
}

function Match({ name, term }: { name: string; term: string }) {
  const index = name.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return name;
  return <>{name.slice(0, index)}<mark className="bg-transparent text-indigo-200">{name.slice(index, index + term.length)}</mark>{name.slice(index + term.length)}</>;
}
