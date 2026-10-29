export type CollectionSection = "champions" | "relics";
export type CollectionView = "catalog" | "personal";

export function collectionPreferenceCookie(section: CollectionSection) {
  return `cerebro-${section}-view`;
}

export function resolveCollectionView(
  explicit: unknown,
  remembered: unknown,
  canUsePersonal: boolean,
): CollectionView {
  if (!canUsePersonal) return "catalog";
  const valid = (value: unknown): value is CollectionView =>
    value === "catalog" || value === "personal";
  return valid(explicit)
    ? explicit
    : valid(remembered)
      ? remembered
      : "personal";
}

export function collectionHref(
  section: CollectionSection,
  view: CollectionView,
  search = "",
) {
  const params = new URLSearchParams(search);
  params.set("view", view);
  return `/${section}?${params}`;
}

export function collectionStateKey(
  section: CollectionSection,
  profile: string,
  view: CollectionView,
  key: string,
  shared = false,
) {
  return `${section}:${profile}:${shared ? "shared" : view}:${key}`;
}

// Created per mounted browser provider, never a module-global cache of personal state.
export function createCollectionMemory() {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T): T {
      return values.has(key) ? (values.get(key) as T) : fallback;
    },
    set<T>(key: string, value: T) {
      values.set(key, value);
    },
  };
}
