import type { ChampionClass } from "@prisma/client";
import type { QuestGateVisual } from "./gate-presentation";

export type QuestGateChampionFilterTerm =
  | { kind: "tag"; value: string; negated: boolean }
  | { kind: "class"; value: ChampionClass; negated: boolean };
/** Alternatives are OR; every term within one alternative is required. */
export type QuestGateChampionFilterGroups = QuestGateChampionFilterTerm[][];
export type QuestGateChampionFilter = QuestGateChampionFilterGroups | "invalid" | null;
export type QuestChampionFilterState = { tags: string[]; tagLogic: "AND" | "OR"; questGate: QuestGateChampionFilter };

const CLASSES = new Set<string>(["SCIENCE", "SKILL", "MUTANT", "TECH", "COSMIC", "MYSTIC", "SUPERIOR"]);
const MAX_QUERY_LENGTH = 8192, MAX_GROUPS = 16, MAX_TERMS = 64;
const validTag = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value) && normalizeQuestChampionTagName(value).length > 0;
export const normalizeQuestChampionTagName = (value: string) => value.trim().replace(/^#/, "").trim().toLowerCase();

function validGroups(value: unknown): value is QuestGateChampionFilterGroups {
  if (!Array.isArray(value) || !value.length || value.length > MAX_GROUPS) return false;
  let terms = 0;
  return value.every(group => Array.isArray(group) && group.length > 0 && (terms += group.length) <= MAX_TERMS && group.every((term: unknown) => {
    if (!term || typeof term !== "object" || Object.keys(term).length !== 3 || !("kind" in term) || !("value" in term) || !("negated" in term) || typeof term.negated !== "boolean") return false;
    return term.kind === "tag" ? validTag(term.value) : term.kind === "class" && typeof term.value === "string" && CLASSES.has(term.value);
  })) && JSON.stringify(value).length <= MAX_QUERY_LENGTH;
}

function json(value: string): unknown {
  if (value.length > MAX_QUERY_LENGTH) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

/** Explicit malformed constraints remain active as an empty result, never a broad fallback. */
export function parseQuestChampionFilterParams(params: URLSearchParams): QuestChampionFilterState & { explicit: boolean; reset: boolean; unowned?: boolean } {
  const empty: QuestChampionFilterState = { tags: [], tagLogic: "AND", questGate: null };
  const explicit = params.has("tags") || params.has("questTags") || params.has("questGate");
  const meta = { explicit, reset: params.get("questGate") === "1", ...(params.get("unowned") === "true" || params.get("unowned") === "false" ? { unowned: params.get("unowned") === "true" } : {}) };
  const invalid = { ...empty, ...meta, questGate: "invalid" as const };
  if (!explicit) return { ...empty, ...meta };
  if (["tags", "tagLogic", "questTags", "questGate"].some(key => params.getAll(key).length > 1)) return invalid;
  if (params.has("questGate") && params.get("questGate") !== "1") return invalid;
  if (params.has("questTags")) {
    if (params.has("tags") || params.has("tagLogic")) return invalid;
    const groups = json(params.get("questTags")!);
    return validGroups(groups) ? { ...empty, ...meta, questGate: groups } : invalid;
  }
  if (!params.has("tags")) return invalid;
  const tags = json(params.get("tags")!);
  const logic = params.get("tagLogic") ?? "AND";
  return Array.isArray(tags) && tags.length > 0 && tags.length <= MAX_TERMS && tags.every(validTag) && (logic === "AND" || logic === "OR")
    ? { tags, tagLogic: logic, questGate: null, ...meta } : invalid;
}

export function matchesQuestGateChampionFilter(champion: { class: ChampionClass; tags?: readonly { name: string }[] }, filter: QuestGateChampionFilter | undefined): boolean {
  if (filter == null) return true;
  if (filter === "invalid") return false;
  const tags = new Set((champion.tags ?? []).map(tag => normalizeQuestChampionTagName(tag.name)));
  return filter.some(group => group.every(term => {
    const matches = term.kind === "class" ? champion.class === term.value : tags.has(normalizeQuestChampionTagName(term.value));
    return term.negated ? !matches : matches;
  }));
}

export function describeQuestGateChampionFilter(filter: QuestGateChampionFilter): string {
  if (filter === "invalid") return "Invalid quest gate filter";
  return `Quest gate: ${(filter ?? []).map(group => {
    const label = group.map(term => `${term.negated ? "not " : ""}${term.kind === "tag" ? `#${term.value.replace(/^#/, "")}` : term.value.charAt(0) + term.value.slice(1).toLowerCase()}`).join(" and ");
    return filter && filter.length > 1 && group.length > 1 ? `(${label})` : label;
  }).join(" or ")}`;
}

export function questGateFilterHref(href: string, state: QuestChampionFilterState): string {
  const url = new URL(href, "https://cerebro.invalid");
  for (const key of ["tags", "tagLogic", "questTags", "questGate"]) url.searchParams.delete(key);
  if (state.questGate !== null) url.searchParams.set("questTags", state.questGate === "invalid" ? "invalid" : JSON.stringify(state.questGate));
  if (state.tags.length) { url.searchParams.set("tags", JSON.stringify(state.tags)); url.searchParams.set("tagLogic", state.tagLogic); }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Links describe source constraints, never derive requirements from display captions. */
export function questGateChampionLinks(visual: QuestGateVisual): { champions: string; roster: string } | undefined {
  const groups = visual.filterGroups;
  if (visual.kind !== "tags" || !validGroups(groups)) return undefined;
  const positiveTags = groups.every(group => group.every(term => term.kind === "tag" && !term.negated));
  const simple = positiveTags && (groups.length === 1 || groups.every(group => group.length === 1));
  const state: QuestChampionFilterState = simple
    ? { tags: groups.flatMap(group => group.map(term => term.value)), tagLogic: groups.length === 1 ? "AND" : "OR", questGate: null }
    : { tags: [], tagLogic: "AND", questGate: groups };
  const search = new URL(questGateFilterHref("/champions", state), "https://cerebro.invalid").searchParams;
  search.set("questGate", "1");
  const catalog = new URLSearchParams(search); catalog.set("view", "catalog"); catalog.set("unowned", "true");
  const roster = new URLSearchParams(search); roster.set("unowned", "false");
  return { champions: `/champions?${catalog}`, roster: `/profile/roster?${roster}` };
}
