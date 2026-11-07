"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCollectionState } from "@/components/collections/collection-navigation";
import { ascensionEligibilityHref } from "@/lib/roster-ascension-filter";

function replaceEligibilityParam(value: boolean) {
  const url = new URL(ascensionEligibilityHref(window.location.href, value));
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
}

function isLegacyNormalization(previous: string, next: string) {
  const params = new URLSearchParams(previous);
  if (params.get("ascensionEligible") !== "true" || params.get("ascensionScope") === "seven-star") return false;
  params.set("ascensionScope", "seven-star");
  return params.toString() === next;
}

/** Old enabled URLs/memory migrate to seven-star eligibility; stars stay untouched. */
export function useAscensionEligibilityFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const explicit = params.get("ascensionEligible");
  const explicitScope = params.get("ascensionScope");
  const orphanedScope = explicit === null && explicitScope !== null;
  const snapshot = params.toString();
  const [saved, setSaved] = useCollectionState("ascensionEligible", false);
  const [navigation, setNavigation] = useState({ snapshot, explicit, removed: false });
  const [pending, setPending] = useState<{ snapshot: string; enabled: boolean } | null>(null);
  const changed = navigation.snapshot !== snapshot;
  const delayedNormalization = pending !== null && isLegacyNormalization(pending.snapshot, snapshot);
  const removedByNavigation = changed ? explicit === null && navigation.explicit !== null : navigation.removed;
  if (changed) {
    setNavigation({ snapshot, explicit, removed: removedByNavigation });
    if (!delayedNormalization) setPending(null);
  }
  const pendingValue = pending && (pending.snapshot === snapshot || delayedNormalization) ? pending.enabled : undefined;
  const enabled = pendingValue ?? (explicit === null ? !orphanedScope && !removedByNavigation && saved : explicit === "true");

  // Next's URL snapshot can lag synchronous history replacement. Never replay
  // the old URL over a user's removal, toggle or reset while it catches up.
  useEffect(() => {
    if (pendingValue === undefined) {
      if (explicit !== null) setSaved(explicit === "true");
      else if (orphanedScope || removedByNavigation) setSaved(false);
    }
  }, [explicit, snapshot, pendingValue, orphanedScope, removedByNavigation, setSaved]);
  useEffect(() => {
    if (pendingValue !== undefined) {
      // A legacy normalization already in flight must not revive a later removal.
      replaceEligibilityParam(pendingValue);
      return;
    }
    // Finish legacy normalization through Next too. A streaming navigation can
    // otherwise commit its old URL after an early hydration replaceState.
    if (enabled && explicitScope !== "seven-star") {
      const url = new URL(ascensionEligibilityHref(window.location.href, true));
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    } else if (enabled) replaceEligibilityParam(true);
    else if (explicitScope !== null) {
      const url = new URL(window.location.href);
      url.searchParams.delete("ascensionScope");
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    }
  }, [enabled, explicitScope, snapshot, pendingValue, router]);

  const change = (value: boolean) => {
    setPending({ snapshot, enabled: value });
    setSaved(value);
    replaceEligibilityParam(value);
  };
  return [enabled, change] as const;
}
