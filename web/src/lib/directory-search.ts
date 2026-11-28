import type { Prisma } from "@prisma/client";

export type DirectorySearchTab = "all" | "players" | "alliances";
export type DirectorySearchView = DirectorySearchTab | "landing";
export type PlayerRosterFilter = "all" | "with" | "without";
export type PlayerBattlegroupFilter = "all" | "none" | "1" | "2" | "3";
export type PlayerSort = "match" | "name" | "prestige" | "roster";
export type SortOrder = "asc" | "desc";
export type AllianceMemberFilter = "all" | "1-10" | "11-30" | "31-plus";
export type AllianceAccessFilter = "all" | "open" | "invite-only";
export type AllianceSort = "match" | "name" | "members";

export type DirectorySearchParams = Record<string, string | string[] | undefined>;

export type NormalizedPlayerSearch = {
  query: string;
  allianceQuery: string;
  roster: PlayerRosterFilter;
  battlegroup: PlayerBattlegroupFilter;
  sort: PlayerSort;
  order: SortOrder;
  page: number;
  pageSize: number;
};

export type NormalizedAllianceSearch = {
  query: string;
  members: AllianceMemberFilter;
  access: AllianceAccessFilter;
  sort: AllianceSort;
  order: SortOrder;
  page: number;
  pageSize: number;
};

export const DIRECTORY_PAGE_SIZE = 20;

const PLAYER_ROSTER_FILTERS = new Set<PlayerRosterFilter>(["all", "with", "without"]);
const PLAYER_BATTLEGROUP_FILTERS = new Set<PlayerBattlegroupFilter>(["all", "none", "1", "2", "3"]);
const PLAYER_SORTS = new Set<PlayerSort>(["match", "name", "prestige", "roster"]);
const ORDERS = new Set<SortOrder>(["asc", "desc"]);
const ALLIANCE_MEMBER_FILTERS = new Set<AllianceMemberFilter>(["all", "1-10", "11-30", "31-plus"]);
const ALLIANCE_ACCESS_FILTERS = new Set<AllianceAccessFilter>(["all", "open", "invite-only"]);
const ALLIANCE_SORTS = new Set<AllianceSort>(["match", "name", "members"]);

export function normalizeDirectoryTab(params: DirectorySearchParams): DirectorySearchTab {
  const tab = readParam(params, "tab");
  if (tab === "players" || tab === "alliances" || tab === "all") return tab;
  if (readParam(params, "q")?.trim()) return "all";
  if (!readParam(params, "playerQuery") && readParam(params, "allianceQuery")?.trim()) return "alliances";
  return "players";
}

export function getDirectorySearchView(params: DirectorySearchParams): DirectorySearchView {
  const tab = normalizeDirectoryTab(params);
  if (tab === "all") return readParam(params, "q")?.trim() ? "all" : "landing";
  const hasFocusedParams = Object.keys(params).some(
    key => /^(player|alliance)/.test(key) && readParam(params, key)?.trim(),
  );
  return readParam(params, "tab") === tab || hasFocusedParams ? tab : "landing";
}

export function directorySearchHref(query = "", tab: DirectorySearchTab = "all") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (tab !== "all") params.set("tab", tab);
  const suffix = params.toString();
  return suffix ? "/search?" + suffix : "/search";
}

export function normalizePlayerSearch(params: DirectorySearchParams): NormalizedPlayerSearch {
  const query = readParam(params, "q")?.trim() || readParam(params, "playerQuery")?.trim() || "";
  return {
    query,
    allianceQuery: readParam(params, "playerAllianceQuery")?.trim() ?? "",
    roster: readEnum(params, "playerRoster", PLAYER_ROSTER_FILTERS, "all"),
    battlegroup: readEnum(params, "playerBattlegroup", PLAYER_BATTLEGROUP_FILTERS, "all"),
    sort: readEnum(params, "playerSort", PLAYER_SORTS, query ? "match" : "name"),
    order: readEnum(params, "playerOrder", ORDERS, "asc"),
    page: readPage(params, "playerPage"),
    pageSize: DIRECTORY_PAGE_SIZE,
  };
}

export function normalizeAllianceSearch(params: DirectorySearchParams): NormalizedAllianceSearch {
  const query = readParam(params, "q")?.trim() || readParam(params, "allianceQuery")?.trim() || "";
  return {
    query,
    members: readEnum(params, "allianceMembers", ALLIANCE_MEMBER_FILTERS, "all"),
    access: readEnum(params, "allianceAccess", ALLIANCE_ACCESS_FILTERS, "all"),
    sort: readEnum(params, "allianceSort", ALLIANCE_SORTS, query ? "match" : "name"),
    order: readEnum(params, "allianceOrder", ORDERS, "asc"),
    page: readPage(params, "alliancePage"),
    pageSize: DIRECTORY_PAGE_SIZE,
  };
}

export function buildPlayerSearchWhere(options: NormalizedPlayerSearch): Prisma.PlayerWhereInput {
  const conditions: Prisma.PlayerWhereInput[] = [];

  if (options.query) {
    conditions.push({
      ingameName: {
        contains: options.query,
        mode: "insensitive",
      },
    });
  }

  if (options.allianceQuery) {
    conditions.push({
      alliance: {
        is: {
          OR: [
            { name: { contains: options.allianceQuery, mode: "insensitive" } },
            { tag: { contains: options.allianceQuery, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (options.roster === "with") {
    conditions.push({ roster: { some: {} } });
  } else if (options.roster === "without") {
    conditions.push({ roster: { none: {} } });
  }

  if (options.battlegroup === "none") {
    conditions.push({ battlegroup: null });
  } else if (options.battlegroup !== "all") {
    conditions.push({ battlegroup: Number(options.battlegroup) });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export function buildPlayerSearchOrderBy(options: NormalizedPlayerSearch): Prisma.PlayerOrderByWithRelationInput {
  if (options.sort === "prestige") {
    return { championPrestige: { sort: options.order, nulls: "last" } };
  }

  if (options.sort === "roster") {
    return { roster: { _count: options.order } };
  }

  return { ingameName: options.order };
}

export function buildAllianceSearchBaseWhere(options: NormalizedAllianceSearch): Prisma.AllianceWhereInput {
  const conditions: Prisma.AllianceWhereInput[] = [
    { members: { some: {} } },
    buildNonGlobalAllianceWhere(),
  ];

  if (options.query) {
    conditions.push({
      OR: [
        { name: { contains: options.query, mode: "insensitive" } },
        { tag: { contains: options.query, mode: "insensitive" } },
      ],
    });
  }

  if (options.access === "open") {
    conditions.push({ inviteOnly: false });
  } else if (options.access === "invite-only") {
    conditions.push({ inviteOnly: true });
  }

  return { AND: conditions };
}

export function buildNonGlobalAllianceWhere(): Prisma.AllianceWhereInput {
  return {
    AND: [
      { NOT: { name: { equals: "GLOBAL", mode: "insensitive" } } },
      {
        OR: [
          { tag: null },
          { NOT: { tag: { equals: "GLOBAL", mode: "insensitive" } } },
        ],
      },
    ],
  };
}

export function allianceMemberFilterMatches(memberCount: number, filter: AllianceMemberFilter) {
  if (filter === "1-10") return memberCount >= 1 && memberCount <= 10;
  if (filter === "11-30") return memberCount >= 11 && memberCount <= 30;
  if (filter === "31-plus") return memberCount >= 31;
  return true;
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function bestTextMatchRank(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  let best = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const normalizedValue = normalizeSearchText(value ?? "");
    if (!normalizedValue) continue;
    if (normalizedValue === normalizedQuery) best = Math.min(best, 0);
    else if (normalizedValue.startsWith(normalizedQuery)) best = Math.min(best, 1);
    else if (normalizedValue.includes(normalizedQuery)) best = Math.min(best, 2);
  }

  return Number.isFinite(best) ? best : 3;
}

export function rankPlayerDirectoryMatch({
  query,
  ingameName,
  allianceName,
  allianceTag,
  rosterCount,
  championPrestige,
}: {
  query: string;
  ingameName: string;
  allianceName?: string | null;
  allianceTag?: string | null;
  rosterCount: number;
  championPrestige?: number | null;
}) {
  const matchRank = bestTextMatchRank(query, [ingameName]);
  const contextRank = bestTextMatchRank(query, [allianceTag, allianceName]);
  const boost =
    Math.min(rosterCount, 300) * 6 +
    (championPrestige ?? 0) / 20 +
    (allianceName ? 250 : 0);

  return matchRank * 1_000_000 + contextRank * 5_000 - boost;
}

export function rankAllianceDirectoryMatch({
  query,
  name,
  tag,
  memberCount,
  inviteOnly,
}: {
  query: string;
  name: string;
  tag?: string | null;
  memberCount: number;
  inviteOnly: boolean;
}) {
  const tagRank = bestTextMatchRank(query, [tag]);
  const nameRank = bestTextMatchRank(query, [name]);
  const matchRank = Math.min(tagRank, nameRank);
  const tagBoost = tagRank < nameRank ? 2_000 : 0;
  const boost = tagBoost + Math.min(memberCount, 100) * 20 + (inviteOnly ? 0 : 350);

  return matchRank * 1_000_000 - boost;
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function readParam(params: DirectorySearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function readEnum<T extends string>(
  params: DirectorySearchParams,
  key: string,
  allowed: Set<T>,
  fallback: T,
) {
  const value = readParam(params, key);
  return value && allowed.has(value as T) ? (value as T) : fallback;
}

function readPage(params: DirectorySearchParams, key: string) {
  const parsed = parseInt(readParam(params, key) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
