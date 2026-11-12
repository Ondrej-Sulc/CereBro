import type { NativeQuestReward } from "../data/game-quests/rewards";

export type DiscoverySection = "Story" | "Special" | "Class Tower" | "Challenge Tower" | "Event Tower";
export type DiscoveryLocation = { title: string; context: string; section: DiscoverySection; href: string };
export type RewardSource = DiscoveryLocation & { key: string; scope: string; quantity: number; minQuantity?: number; maxQuantity?: number };
export type RewardDiscovery = { type: string; token: string; sample: NativeQuestReward; sources: RewardSource[] };
export type GameDiscovery = {
  version: 1; nodeCatalogHash: string;
  coverage: { quests: number; towerBlocks: number };
  nodes: Record<string, DiscoveryLocation[]>;
  rewards: Record<string, RewardDiscovery>;
};
export const rewardIdentity = (type: string, token: string) => JSON.stringify([type, token]);
export const rewardSourcesHref = (type: string, token: string) => `/rewards?${new URLSearchParams({ type, item: token })}`;
export function matchesDiscoveryQuery(text: string, query: string) {
  const normalize = (value: string) => value.normalize("NFKD").toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "");
  const normalized = normalize(text);
  return query.trim().split(/\s+/).filter(Boolean).every(term => normalized.includes(normalize(term)));
}
export const discoverySections: DiscoverySection[] = ["Story", "Special", "Class Tower", "Challenge Tower", "Event Tower"];
export type PackedGameDiscovery = Omit<GameDiscovery, "nodes" | "rewards"> & {
  locations: DiscoveryLocation[]; scopes: string[]; nodes: Record<string, number[]>;
  rewards: Record<string, Omit<RewardDiscovery, "sources"> & { sources: [number, number, number, number | null, number | null][] }>;
};
export function packDiscovery(data: GameDiscovery): PackedGameDiscovery {
  const locations: DiscoveryLocation[] = [], scopes: string[] = [];
  const identities = new Map<string, number>();
  const locationId = ({ title, context, section, href }: DiscoveryLocation) => {
    const row = { title, context, section, href }, key = JSON.stringify(row);
    if (!identities.has(key)) { identities.set(key, locations.length); locations.push(row); }
    return identities.get(key)!;
  };
  const scopeId = (scope: string) => { if (!scopes.includes(scope)) scopes.push(scope); return scopes.indexOf(scope); };
  return { version: 1, nodeCatalogHash: data.nodeCatalogHash, coverage: data.coverage, locations, scopes,
    nodes: Object.fromEntries(Object.entries(data.nodes).map(([id, rows]) => [id, rows.map(locationId)])),
    rewards: Object.fromEntries(Object.entries(data.rewards).map(([key, reward]) => [key, { ...reward, sources: reward.sources.map(r => [locationId(r), scopeId(r.scope), r.quantity, r.minQuantity ?? null, r.maxQuantity ?? null]) }])) };
}
export function discoveryResults<T extends DiscoveryLocation>(rows: T[], filters: { q?: string; section?: string; scope?: string; page?: string }) {
  const matched = rows.filter(row => (!filters.section || row.section === filters.section)
    && (!filters.scope || ("scope" in row && row.scope === filters.scope))
    && matchesDiscoveryQuery(`${row.title} ${row.context}`, filters.q ?? ""));
  const pages = Math.max(1, Math.ceil(matched.length / 20));
  const requested = Number(filters.page);
  const page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  return { rows: matched.slice((page - 1) * 20, page * 20), total: matched.length, pages, page };
}
