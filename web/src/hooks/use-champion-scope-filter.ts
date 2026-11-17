"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCollectionState } from "@/components/collections/collection-navigation";
import { championScopeHref, normalizeChampionScope, type ChampionScope } from "@/lib/champion-catalog-scope";

function replaceScope(scope: ChampionScope) {
  const href = championScopeHref(window.location.href, scope);
  if (href !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", href);
}

/** Share explicit scopes in links and remember ordinary browsing separately per view/profile. */
export function useChampionScopeFilter() {
  const params = useSearchParams();
  const explicit = params.get("championScope");
  const snapshot = params.toString();
  const [saved, setSaved] = useCollectionState<ChampionScope>("championScope", "playable");
  const [navigation, setNavigation] = useState({ snapshot, explicit, removed: false });
  const [pending, setPending] = useState<{ snapshot: string; scope: ChampionScope } | null>(null);
  const changed = navigation.snapshot !== snapshot;
  const removedByNavigation = changed ? explicit === null && navigation.explicit !== null : navigation.removed;
  if (changed) {
    setNavigation({ snapshot, explicit, removed: removedByNavigation });
    setPending(null);
  }
  // Next's search snapshot may lag a synchronous history update.
  const pendingScope = pending?.snapshot === snapshot ? pending.scope : undefined;
  const scope = pendingScope ?? (explicit !== null ? normalizeChampionScope(explicit) : removedByNavigation ? "playable" : saved);

  useEffect(() => {
    if (pendingScope === undefined && (explicit !== null || removedByNavigation)) setSaved(scope);
    replaceScope(scope);
  }, [explicit, snapshot, pendingScope, removedByNavigation, scope, setSaved]);

  return [scope, (value: ChampionScope) => {
    setPending({ snapshot, scope: value });
    setSaved(value);
    replaceScope(value);
  }] as const;
}
