"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCollectionState } from "@/components/collections/collection-navigation";
import { normalizeQuestChampionTagName, parseQuestChampionFilterParams, questGateFilterHref, type QuestChampionFilterState, type QuestGateChampionFilter } from "@/lib/game-quests/gate-champion-filter";

function replaceFilter(state: QuestChampionFilterState) {
  const href = questGateFilterHref(window.location.href, state);
  if (href !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", href);
}

/** Explicit links take priority over per-view memory; ordinary browsing keeps its existing state. */
export function useQuestChampionFilter(availableTags: readonly { name: string }[], onFreshGate?: (unowned: boolean | undefined) => void) {
  const params = useSearchParams();
  const snapshot = params.toString();
  const parsed = useMemo(() => {
    const result = parseQuestChampionFilterParams(new URLSearchParams(snapshot));
    const resolve = (name: string) => {
      const exact = availableTags.find(tag => tag.name === name);
      if (exact) return exact.name;
      const matches = availableTags.filter(tag => normalizeQuestChampionTagName(tag.name) === normalizeQuestChampionTagName(name));
      return matches.length === 1 ? matches[0].name : undefined;
    };
    // DB labels sometimes include a leading #. Join only complete normalized names.
    result.tags = result.tags.map(name => resolve(name) ?? name);
    // Unknown exclusions must not broaden a result just because no DB tag could be joined.
    if (Array.isArray(result.questGate) && result.questGate.some(group => group.some(term => term.kind === "tag" && resolve(term.value) === undefined))) result.questGate = "invalid";
    return result;
  }, [snapshot, availableTags]);
  const [savedTags, setSavedTags] = useCollectionState<string[]>("tags", []);
  const [savedLogic, setSavedLogic] = useCollectionState<"AND" | "OR">("tagLogic", "AND");
  const [savedGate, setSavedGate] = useCollectionState<QuestGateChampionFilter>("questTags", null);
  const [navigation, setNavigation] = useState({ snapshot, explicit: parsed.explicit, removed: false });
  const [pending, setPending] = useState<{ snapshot: string; value: QuestChampionFilterState } | null>(null);
  const changed = navigation.snapshot !== snapshot;
  const removed = changed ? !parsed.explicit && navigation.explicit : navigation.removed;
  if (changed) { setNavigation({ snapshot, explicit: parsed.explicit, removed }); setPending(null); }
  const pendingValue = pending?.snapshot === snapshot ? pending.value : undefined;
  const value: QuestChampionFilterState = pendingValue ?? (parsed.explicit ? parsed : removed ? { tags: [], tagLogic: "AND", questGate: null } : { tags: savedTags, tagLogic: savedLogic, questGate: savedGate });
  const liveValue = useRef(value);
  liveValue.current = value;
  const valueKey = JSON.stringify([value.tags, value.tagLogic, value.questGate]);
  useEffect(() => {
    if (pendingValue === undefined && (parsed.explicit || removed)) {
      setSavedTags(value.tags); setSavedLogic(value.tagLogic); setSavedGate(value.questGate);
    }
    // valueKey carries the complete parsed state without replaying equivalent arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, valueKey, parsed.explicit, removed, pendingValue, setSavedTags, setSavedLogic, setSavedGate]);
  const resetKey = parsed.reset ? JSON.stringify([params.get("view"), params.get("tags"), params.get("tagLogic"), params.get("questTags"), parsed.unowned]) : null;
  const appliedReset = useRef<string | null>(null);
  useEffect(() => {
    if (resetKey !== null && appliedReset.current !== resetKey) onFreshGate?.(parsed.unowned);
    appliedReset.current = resetKey;
  }, [resetKey, parsed.unowned, onFreshGate]);

  const change = (update: (current: QuestChampionFilterState) => QuestChampionFilterState) => {
    const next = update(liveValue.current);
    liveValue.current = next;
    setPending({ snapshot, value: next });
    setSavedTags(next.tags); setSavedLogic(next.tagLogic); setSavedGate(next.questGate);
    replaceFilter(next);
  };
  return {
    ...value,
    setTags: (tags: string[]) => change(current => ({ ...current, tags })),
    setTagLogic: (tagLogic: "AND" | "OR") => change(current => ({ ...current, tagLogic })),
    clearQuestGate: () => change(current => ({ ...current, questGate: null })),
    clear: () => change(() => ({ tags: [], tagLogic: "AND", questGate: null })),
  };
}
