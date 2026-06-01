import type { Prisma } from "@prisma/client";

export type DirectorySearchTab = "players" | "alliances";
export type PlayerRosterFilter = "all" | "with" | "without";
export type PlayerBattlegroupFilter = "all" | "none" | "1" | "2" | "3";
export type PlayerSort = "name" | "prestige" | "roster";
export type SortOrder = "asc" | "desc";
export type AllianceMemberFilter = "all" | "1-10" | "11-30" | "31-plus";
export type AllianceAccessFilter = "all" | "open" | "invite-only";
export type AllianceSort = "name" | "members";

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
const PLAYER_SORTS = new Set<PlayerSort>(["name", "prestige", "roster"]);
const ORDERS = new Set<SortOrder>(["asc", "desc"]);
const ALLIANCE_MEMBER_FILTERS = new Set<AllianceMemberFilter>(["all", "1-10", "11-30", "31-plus"]);
const ALLIANCE_ACCESS_FILTERS = new Set<AllianceAccessFilter>(["all", "open", "invite-only"]);
const ALLIANCE_SORTS = new Set<AllianceSort>(["name", "members"]);

export function normalizeDirectoryTab(params: DirectorySearchParams): DirectorySearchTab {
  return readParam(params, "tab") === "alliances" ? "alliances" : "players";
}

export function normalizePlayerSearch(params: DirectorySearchParams): NormalizedPlayerSearch {
  return {
    query: readParam(params, "playerQuery")?.trim() ?? "",
    allianceQuery: readParam(params, "playerAllianceQuery")?.trim() ?? "",
    roster: readEnum(params, "playerRoster", PLAYER_ROSTER_FILTERS, "all"),
    battlegroup: readEnum(params, "playerBattlegroup", PLAYER_BATTLEGROUP_FILTERS, "all"),
    sort: readEnum(params, "playerSort", PLAYER_SORTS, "name"),
    order: readEnum(params, "playerOrder", ORDERS, "asc"),
    page: readPage(params, "playerPage"),
    pageSize: DIRECTORY_PAGE_SIZE,
  };
}

export function normalizeAllianceSearch(params: DirectorySearchParams): NormalizedAllianceSearch {
  return {
    query: readParam(params, "allianceQuery")?.trim() ?? "",
    members: readEnum(params, "allianceMembers", ALLIANCE_MEMBER_FILTERS, "all"),
    access: readEnum(params, "allianceAccess", ALLIANCE_ACCESS_FILTERS, "all"),
    sort: readEnum(params, "allianceSort", ALLIANCE_SORTS, "name"),
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
    {
      NOT: [
        { name: { equals: "GLOBAL", mode: "insensitive" } },
        { tag: { equals: "GLOBAL", mode: "insensitive" } },
      ],
    },
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
