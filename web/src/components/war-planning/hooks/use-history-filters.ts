"use client";

import { useCallback, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { historyFilterStorageKey, parseHistoryFilters, saveHistoryFilters, type HistoryFilters, type HistoryFilterScope } from "@/lib/war-history-filters";

const memory = new Map<HistoryFilterScope, string>();
const storageFailed = new Set<HistoryFilterScope>();

function browserStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

function snapshot(scope: HistoryFilterScope): string | null {
  if (storageFailed.has(scope)) return memory.get(scope) ?? null;
  try { return browserStorage()?.getItem(historyFilterStorageKey(scope)) ?? memory.get(scope) ?? null; }
  catch { return memory.get(scope) ?? null; }
}

const serverSnapshot = () => null;

/** Hydrates after SSR and keeps working in memory if browser storage is unavailable. */
export function useHistoryFilters(scope: HistoryFilterScope, latestSeason: number | null): [HistoryFilters, Dispatch<SetStateAction<HistoryFilters>>] {
  const subscribe = useCallback((notify: () => void) => {
    const eventName = historyFilterStorageKey(scope);
    const onStorage = (event: StorageEvent) => {
      if (event.key === eventName || event.key === null) {
        storageFailed.delete(scope);
        memory.delete(scope);
        notify();
      }
    };
    window.addEventListener(eventName, notify);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", onStorage); };
  }, [scope]);
  const getSnapshot = useCallback(() => snapshot(scope), [scope]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const filters = useMemo(() => parseHistoryFilters(raw, latestSeason), [raw, latestSeason]);
  const setFilters = useCallback<Dispatch<SetStateAction<HistoryFilters>>>(update => {
    const previous = parseHistoryFilters(snapshot(scope), latestSeason);
    const next = parseHistoryFilters(JSON.stringify(typeof update === "function" ? update(previous) : update), latestSeason);
    memory.set(scope, JSON.stringify(next));
    if (!saveHistoryFilters(browserStorage(), scope, next)) storageFailed.add(scope);
    window.dispatchEvent(new Event(historyFilterStorageKey(scope)));
  }, [scope, latestSeason]);
  return [filters, setFilters];
}
