"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Search, Shield, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import type { DirectorySearchTab } from "@/lib/directory-search";

type DirectorySuggestionResponse = {
  players: Array<{
    id: string;
    ingameName: string;
    avatar: string | null;
    championPrestige: number | null;
    alliance: { id: string; name: string; tag: string | null } | null;
    _count: { roster: number };
  }>;
  alliances: Array<{
    id: string;
    name: string;
    tag: string | null;
    inviteOnly: boolean;
    _count: { members: number };
  }>;
};

export function DirectorySearchBox({
  activeTab,
  initialValue,
}: {
  activeTab: DirectorySearchTab;
  initialValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<DirectorySuggestionResponse>({ players: [], alliances: [] });
  const debouncedValue = useDebounce(value, 250);
  const requestSeqRef = useRef(0);
  const suppressedQueryRef = useRef("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = debouncedValue.trim();
    if (query.length < 2 || query === suppressedQueryRef.current) {
      return;
    }

    const controller = new AbortController();
    const seq = ++requestSeqRef.current;

    fetch(`/api/search/directory?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Search failed");
        return await res.json() as DirectorySuggestionResponse;
      })
      .then((data) => {
        if (seq === requestSeqRef.current && query !== suppressedQueryRef.current) {
          setSuggestions({ players: data.players ?? [], alliances: data.alliances ?? [] });
          setOpen(true);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        if (seq === requestSeqRef.current && query !== suppressedQueryRef.current) {
          setSuggestions({ players: [], alliances: [] });
          setOpen(true);
        }
      })

    return () => controller.abort();
  }, [debouncedValue]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        suppressedQueryRef.current = value.trim();
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [value]);

  const suggestionCount = suggestions.players.length + suggestions.alliances.length;
  const hint = useMemo(() => activeTab === "players" ? "Search player profiles" : "Search alliances", [activeTab]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    suppressedQueryRef.current = value.trim();
    requestSeqRef.current += 1;
    setSuggestions({ players: [], alliances: [] });
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    if (activeTab === "players") {
      setParam(params, "playerQuery", value.trim());
      params.delete("playerPage");
    } else {
      setParam(params, "allianceQuery", value.trim());
      params.delete("alliancePage");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearSearch = () => {
    suppressedQueryRef.current = "";
    setValue("");
    setSuggestions({ players: [], alliances: [] });
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (activeTab === "players") {
      params.delete("playerQuery");
      params.delete("playerPage");
    } else {
      params.delete("allianceQuery");
      params.delete("alliancePage");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={submitSearch} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.20)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value;
                suppressedQueryRef.current = "";
                setValue(nextValue);
                setOpen(true);
                if (nextValue.trim().length < 2) {
                  setSuggestions({ players: [], alliances: [] });
                }
              }}
              onFocus={() => {
                if (value.trim().length >= 2 && value.trim() !== suppressedQueryRef.current) setOpen(true);
              }}
              placeholder={hint}
              className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 pl-12 pr-11 text-base font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-sky-700"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  suppressedQueryRef.current = value.trim();
                  requestSeqRef.current += 1;
                  setSuggestions({ players: [], alliances: [] });
                  setOpen(false);
                }
                if (event.key === "Escape") {
                  suppressedQueryRef.current = value.trim();
                  setOpen(false);
                }
              }}
            />
            {value ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Button type="submit" className="h-12 gap-2 rounded-xl px-5">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </form>

      {open && value.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
          {suggestionCount > 0 ? (
            <div className="max-h-[420px] overflow-y-auto p-2">
              {suggestions.players.length > 0 && (
                <SuggestionGroup icon={<Users className="h-3.5 w-3.5" />} label="Players">
                  {suggestions.players.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => router.push(`/player/${player.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-900"
                    >
                      <Avatar className="h-9 w-9 border border-slate-800">
                        <AvatarImage src={player.avatar ?? undefined} />
                        <AvatarFallback>{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-100">{player.ingameName}</div>
                        <div className="truncate text-xs text-slate-500">
                          {player.alliance ? `${player.alliance.tag ? `[${player.alliance.tag}] ` : ""}${player.alliance.name}` : "Unaffiliated"}
                        </div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <Badge variant="outline" className="border-slate-800 text-slate-400">{player._count.roster} champs</Badge>
                        <span className="font-mono text-xs text-amber-300">{player.championPrestige?.toLocaleString("en-US") ?? "N/A"}</span>
                      </div>
                    </button>
                  ))}
                </SuggestionGroup>
              )}
              {suggestions.alliances.length > 0 && (
                <SuggestionGroup icon={<Shield className="h-3.5 w-3.5" />} label="Alliances">
                  {suggestions.alliances.map((alliance) => (
                    <button
                      key={alliance.id}
                      type="button"
                      onClick={() => router.push(`/alliance/${alliance.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-900"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {alliance.tag ? `[${alliance.tag}] ` : ""}{alliance.name}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {alliance._count.members.toLocaleString("en-US")} members
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("hidden shrink-0 sm:inline-flex", alliance.inviteOnly ? "border-amber-800 text-amber-300" : "border-emerald-800 text-emerald-300")}
                      >
                        {alliance.inviteOnly ? "Invite only" : "Open"}
                      </Badge>
                    </button>
                  ))}
                </SuggestionGroup>
              )}
            </div>
          ) : (
            <div className="p-5 text-center text-sm text-slate-500">
              No suggestions found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionGroup({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {icon}
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function setParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}
