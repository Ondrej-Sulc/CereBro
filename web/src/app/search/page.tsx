import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, Users, Trophy, LayoutGrid, Crown, ArrowRight, ChevronDown, ChevronRight, SlidersHorizontal, X, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import {
  allianceMemberFilterMatches,
  buildAllianceSearchBaseWhere,
  buildNonGlobalAllianceWhere,
  buildPlayerSearchOrderBy,
  buildPlayerSearchWhere,
  normalizeAllianceSearch,
  directorySearchHref,
  getDirectorySearchView,
  normalizePlayerSearch,
  paginate,
  rankAllianceDirectoryMatch,
  rankPlayerDirectoryMatch,
  type DirectorySearchParams,
  type DirectorySearchTab,
  type NormalizedAllianceSearch,
  type NormalizedPlayerSearch,
} from "@/lib/directory-search";
import { computePaginationWindow } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { buildSearchParams, cn } from "@/lib/utils";
import { DirectorySearchBox } from "./directory-search-box";

export const metadata: Metadata = {
  title: "Search - CereBro",
  description: "Search CereBro player profiles and alliances.",
};

type SearchPageProps = {
  searchParams: Promise<DirectorySearchParams>;
};

type PlayerResult = Awaited<ReturnType<typeof getPlayerResults>>["players"][number];
type AllianceResult = Awaited<ReturnType<typeof getAllianceResults>>["alliances"][number];
const directoryPreviewSize = 3;

export default async function DirectorySearchPage({ searchParams }: SearchPageProps) {
  const currentUser = await getUserPlayerWithAlliance();
  if (!currentUser) {
    redirect("/api/auth/discord-login?redirectTo=/search");
  }

  const params = await searchParams;
  const view = getDirectorySearchView(params);
  const playerOptions = normalizePlayerSearch(params);
  const allianceOptions = normalizeAllianceSearch(params);
  const query = view === "alliances" ? allianceOptions.query : view === "landing" ? "" : playerOptions.query;
  const isAll = view === "all";
  const [playerResults, allianceResults, discovery] = await Promise.all([
    isAll ? getPlayerResults({ ...normalizePlayerSearch({ q: query }), pageSize: directoryPreviewSize })
      : view === "players" ? getPlayerResults(playerOptions) : null,
    isAll ? getAllianceResults({ ...normalizeAllianceSearch({ q: query }), pageSize: directoryPreviewSize })
      : view === "alliances" ? getAllianceResults(allianceOptions) : null,
    view === "landing" ? getDefaultDiscovery() : null,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
      <header className={cn(
        "relative isolate",
        discovery ? "pb-6 pt-9 text-center sm:pb-10 sm:pt-14" : "pb-4 pt-6 sm:pb-5",
      )}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.18),transparent_72%)]" />
        <h1 className={cn(
          "font-bold leading-tight tracking-tight text-white",
          discovery ? "mx-auto mb-4 max-w-[18rem] text-3xl sm:mb-5 sm:max-w-none sm:text-5xl" : "mb-3 text-2xl sm:text-3xl",
        )}>
          {discovery ? "Find players and alliances" : "Search"}
        </h1>
        <div className={discovery ? "mx-auto max-w-[43rem]" : "max-w-[43rem]"}>
          <DirectorySearchBox key={query} initialValue={query} />
        </div>
        {discovery && <DirectoryTotals players={discovery.playerCount} alliances={discovery.allianceCount} />}
      </header>

      {discovery ? (
        <div className="grid gap-3 sm:gap-5 md:grid-cols-2">
          <DirectoryGroup title="Top player profiles" href={directorySearchHref("", "players")} action="Browse players" icon={<Trophy className="size-4" aria-hidden="true" />} discovery>
            {discovery.players.map(player => <PlayerRow key={player.id} player={player} compact />)}
          </DirectoryGroup>
          <DirectoryGroup title="Open alliances" href={directorySearchHref("", "alliances")} action="Browse alliances" icon={<Shield className="size-4" aria-hidden="true" />} discovery>
            {discovery.alliances.map(alliance => <AllianceRow key={alliance.id} alliance={alliance} compact />)}
          </DirectoryGroup>
        </div>
      ) : isAll && playerResults && allianceResults ? (
        <>
          <ResultToolbar tab="all" query={query} />
          <ResultHeading count={playerResults.totalCount + allianceResults.totalCount} label="result" query={query} />
          {playerResults.totalCount + allianceResults.totalCount > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 md:gap-7">
              <DirectoryGroup title="Players" count={playerResults.totalCount} href={directorySearchHref(query, "players")} action={groupAction(playerResults.totalCount, "players")}>
                {playerResults.players.map(player => <PlayerRow key={player.id} player={player} compact />)}
              </DirectoryGroup>
              <DirectoryGroup title="Alliances" count={allianceResults.totalCount} href={directorySearchHref(query, "alliances")} action={groupAction(allianceResults.totalCount, "alliances")}>
                {allianceResults.alliances.map(alliance => <AllianceRow key={alliance.id} alliance={alliance} compact />)}
              </DirectoryGroup>
            </div>
          ) : <EmptyState label="No matching players or alliances" />}
        </>
      ) : view === "players" && playerResults ? (
        <>
          <ResultToolbar tab="players" query={query}>
            <PlayerControls options={playerOptions} params={params} />
          </ResultToolbar>
          <ResultHeading count={playerResults.totalCount} label="player" query={query} />
          {playerResults.players.length ? (
            <>
              <ColumnLabels labels={["Player", "Prestige", "Roster", "Group"]} />
              <ul className="divide-y divide-slate-800/80">{playerResults.players.map(player => <PlayerRow key={player.id} player={player} />)}</ul>
            </>
          ) : <EmptyState label="No matching players" />}
          <DirectoryPagination params={params} pageParam="playerPage" page={playerOptions.page} pageSize={playerOptions.pageSize} totalCount={playerResults.totalCount} />
        </>
      ) : allianceResults && (
        <>
          <ResultToolbar tab="alliances" query={query}>
            <AllianceControls options={allianceOptions} params={params} />
          </ResultToolbar>
          <ResultHeading count={allianceResults.totalCount} label="alliance" query={query} />
          {allianceResults.alliances.length ? (
            <>
              <ColumnLabels labels={["Alliance", "Members", "Avg. prestige", "Access"]} />
              <ul className="divide-y divide-slate-800/80">{allianceResults.alliances.map(alliance => <AllianceRow key={alliance.id} alliance={alliance} />)}</ul>
            </>
          ) : <EmptyState label="No matching alliances" />}
          <DirectoryPagination params={params} pageParam="alliancePage" page={allianceOptions.page} pageSize={allianceOptions.pageSize} totalCount={allianceResults.totalCount} />
        </>
      )}
    </div>
  );
}

async function getPlayerResults(options: NormalizedPlayerSearch) {
  const where = buildPlayerSearchWhere(options);
  const orderBy = buildPlayerSearchOrderBy(options);
  const shouldRank = options.sort === "match" && options.query.length > 0;
  const [players, totalCount] = await Promise.all([
    prisma.player.findMany({
      where,
      orderBy: [orderBy, { ingameName: "asc" }],
      select: {
        id: true,
        ingameName: true,
        avatar: true,
        championPrestige: true,
        summonerPrestige: true,
        battlegroup: true,
        isOfficer: true,
        alliance: {
          select: {
            id: true,
            name: true,
            tag: true,
          },
        },
        _count: {
          select: {
            roster: true,
          },
        },
      },
      skip: shouldRank ? undefined : (options.page - 1) * options.pageSize,
      take: shouldRank ? undefined : options.pageSize,
    }),
    prisma.player.count({ where }),
  ]);

  if (!shouldRank) return { players, totalCount };

  const rankedPlayers = players
    .sort((a, b) => {
      const aRank = rankPlayerDirectoryMatch({
        query: options.query,
        ingameName: a.ingameName,
        allianceName: a.alliance?.name,
        allianceTag: a.alliance?.tag,
        rosterCount: a._count.roster,
        championPrestige: a.championPrestige,
      });
      const bRank = rankPlayerDirectoryMatch({
        query: options.query,
        ingameName: b.ingameName,
        allianceName: b.alliance?.name,
        allianceTag: b.alliance?.tag,
        rosterCount: b._count.roster,
        championPrestige: b.championPrestige,
      });
      return aRank - bRank || a.ingameName.localeCompare(b.ingameName, undefined, { sensitivity: "base" });
    });

  return { players: paginate(rankedPlayers, options.page, options.pageSize), totalCount };
}

async function getAllianceResults(options: NormalizedAllianceSearch) {
  const rows = await prisma.alliance.findMany({
    where: buildAllianceSearchBaseWhere(options),
    orderBy: options.sort === "name" ? { name: options.order } : { name: "asc" },
    select: {
      id: true,
      name: true,
      tag: true,
      description: true,
      inviteOnly: true,
      members: {
        select: {
          championPrestige: true,
          battlegroup: true,
        },
      },
    },
  });

  const alliances = rows
    .map(toAllianceResult)
    .filter((alliance) => allianceMemberFilterMatches(alliance.memberCount, options.members))
    .sort((a, b) => {
      if (options.sort === "match" && options.query) {
        const aRank = rankAllianceDirectoryMatch({
          query: options.query,
          name: a.name,
          tag: a.tag,
          memberCount: a.memberCount,
          inviteOnly: a.inviteOnly,
        });
        const bRank = rankAllianceDirectoryMatch({
          query: options.query,
          name: b.name,
          tag: b.tag,
          memberCount: b.memberCount,
          inviteOnly: b.inviteOnly,
        });
        return aRank - bRank || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (options.sort === "members") {
        const memberCompare = a.memberCount - b.memberCount;
        if (memberCompare !== 0) return options.order === "asc" ? memberCompare : -memberCompare;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * (options.order === "asc" ? 1 : -1);
    });

  return {
    alliances: paginate(alliances, options.page, options.pageSize),
    totalCount: alliances.length,
  };
}

async function getDefaultDiscovery() {
  const [players, allianceRows, playerCount, allianceCount] = await Promise.all([
    prisma.player.findMany({
      where: {
        championPrestige: { not: null },
        roster: { some: {} },
      },
      orderBy: [
        { championPrestige: { sort: "desc", nulls: "last" } },
        { ingameName: "asc" },
      ],
      select: {
        id: true,
        ingameName: true,
        avatar: true,
        championPrestige: true,
        summonerPrestige: true,
        battlegroup: true,
        isOfficer: true,
        alliance: {
          select: {
            id: true,
            name: true,
            tag: true,
          },
        },
        _count: {
          select: {
            roster: true,
          },
        },
      },
      take: directoryPreviewSize,
    }),
    prisma.alliance.findMany({
      where: {
        AND: [
          { inviteOnly: false },
          { members: { some: {} } },
          buildNonGlobalAllianceWhere(),
        ],
      },
      orderBy: [{ members: { _count: "desc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        tag: true,
        description: true,
        inviteOnly: true,
        members: {
          select: {
            championPrestige: true,
            battlegroup: true,
          },
        },
      },
      take: directoryPreviewSize,
    }),
    prisma.player.count(),
    prisma.alliance.count({ where: buildAllianceSearchBaseWhere(normalizeAllianceSearch({})) }),
  ]);

  return {
    players,
    alliances: allianceRows.map(toAllianceResult),
    playerCount,
    allianceCount,
  };
}

function toAllianceResult(alliance: {
  id: string;
  name: string;
  tag: string | null;
  description: string | null;
  inviteOnly: boolean;
  members: Array<{ championPrestige: number | null; battlegroup: number | null }>;
}) {
  const prestigeValues = alliance.members
    .map((member) => member.championPrestige)
    .filter((value): value is number => value != null);
  const bgCounts = alliance.members.reduce(
    (counts, member) => {
      if (member.battlegroup === 1) counts.bg1 += 1;
      else if (member.battlegroup === 2) counts.bg2 += 1;
      else if (member.battlegroup === 3) counts.bg3 += 1;
      else counts.unassigned += 1;
      return counts;
    },
    { bg1: 0, bg2: 0, bg3: 0, unassigned: 0 },
  );

  return {
    id: alliance.id,
    name: alliance.name,
    tag: alliance.tag,
    description: alliance.description,
    inviteOnly: alliance.inviteOnly,
    memberCount: alliance.members.length,
    averageChampionPrestige: prestigeValues.length
      ? Math.round(prestigeValues.reduce((sum, value) => sum + value, 0) / prestigeValues.length)
      : null,
    bgCounts,
  };
}

const controlClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";
const rowGrid = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 md:grid-cols-[minmax(0,1fr)_7rem_6.5rem_5.5rem_1rem] md:gap-x-3";
const rowMetrics = "col-span-2 col-start-1 row-start-2 ml-11 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:contents";
const rowIdentity = "flex min-w-0 items-center gap-2.5";
const rowAction = "rounded-lg px-1.5 py-2 hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300 sm:px-2";

function DirectoryTotals({ players, alliances }: { players: number; alliances: number }) {
  return (
    <dl aria-label="Directory totals" className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400 sm:text-sm">
      <div className="flex items-baseline gap-1.5">
        <dt>{players === 1 ? "player profile" : "player profiles"}</dt>
        <dd className="order-first font-semibold text-slate-100 tabular-nums">{players.toLocaleString("en-US")}</dd>
      </div>
      <div className="flex items-baseline gap-1.5 before:order-first before:mr-1.5 before:text-slate-600 before:content-['·']">
        <dt>{alliances === 1 ? "alliance" : "alliances"}</dt>
        <dd className="-order-1 font-semibold text-slate-100 tabular-nums">{alliances.toLocaleString("en-US")}</dd>
      </div>
    </dl>
  );
}

function groupAction(count: number, target: "players" | "alliances") {
  return count > directoryPreviewSize ? `See all ${count.toLocaleString("en-US")} ${target}` : `View ${target}`;
}

function DirectoryGroup({ title, href, action, count, icon, discovery, children }: {
  title: string;
  href: string;
  action: string;
  count?: number;
  icon?: ReactNode;
  discovery?: boolean;
  children: ReactNode[];
}) {
  return (
    <section aria-label={title} className={cn("min-w-0", discovery && "rounded-xl border border-slate-800 bg-slate-900/45 px-3 pb-1 pt-3 sm:px-4")}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-800/80 pb-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-slate-100">
          {icon}{title} {count !== undefined && <span className="text-xs font-medium text-slate-400 tabular-nums">{count.toLocaleString("en-US")}</span>}
        </h2>
        {(count === undefined || count > 0) && (
          <Link href={href} className="inline-flex min-h-8 items-center gap-1.5 rounded text-xs font-medium text-indigo-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
            {action}<ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children.length > 0 ? <ul className="divide-y divide-slate-800/80">{children}</ul> : <p className="py-4 text-sm text-slate-400">No {title.toLowerCase()} to show.</p>}
    </section>
  );
}

function ResultToolbar({ tab, query, params, children }: {
  tab: DirectorySearchTab;
  query: string;
  params?: DirectorySearchParams;
  children?: ReactNode;
}) {
  const links = [
    { tab: "all", label: "All results", icon: LayoutGrid },
    { tab: "players", label: "Players", icon: Users },
    { tab: "alliances", label: "Alliances", icon: Shield },
  ] as const;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
      <nav aria-label="Result type" className="flex flex-wrap items-center gap-0.5 sm:gap-1">
        {links.filter(link => query || link.tab !== "all").map(({ tab: target, label, icon: Icon }) => (
          <Link
            key={target}
            href={target === tab && params ? "/search" + buildSearchParams(params) : directorySearchHref(query, target)}
            aria-current={tab === target ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:px-3 sm:text-sm",
              tab === target ? "border-indigo-400/30 bg-indigo-400/15 text-indigo-100" : "border-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />{label}
          </Link>
        ))}
      </nav>
      {children && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>}
    </div>
  );
}

const fieldClass = "grid gap-1 text-xs font-medium text-slate-300";
const inputClass = "h-9 min-w-0 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";

function FilterField({ label, name, value, items }: {
  label: string;
  name: string;
  value: string;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <label className={fieldClass}>
      <span>{label}</span>
      <select name={name} defaultValue={value} className={inputClass}>
        {items.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

function Filters({ options, tab, count, children }: {
  options: Pick<NormalizedPlayerSearch | NormalizedAllianceSearch, "query" | "sort" | "order">;
  tab: "players" | "alliances";
  count: number;
  children: ReactNode;
}) {
  const scope = tab === "players" ? "player" : "alliance";
  return (
    <details className="relative">
      <summary className={cn(controlClass, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />Filters{count > 0 && <span>({count})</span>}
      </summary>
      <form action="/search" className="absolute right-0 top-full z-20 mt-2 grid w-[min(17rem,calc(100vw-2rem))] gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl shadow-black/35">
        <input type="hidden" name="tab" value={tab} />
        {options.query && <input type="hidden" name="q" value={options.query} />}
        <input type="hidden" name={scope + "Sort"} value={options.sort} />
        <input type="hidden" name={scope + "Order"} value={options.order} />
        {children}
        <button type="submit" className="w-fit rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">Apply filters</button>
      </form>
    </details>
  );
}

function SortMenu({ options, params, tab }: {
  options: Pick<NormalizedPlayerSearch | NormalizedAllianceSearch, "query" | "sort" | "order">;
  params: DirectorySearchParams;
  tab: "players" | "alliances";
}) {
  const player = tab === "players";
  const scope = player ? "player" : "alliance";
  const choices = [
    ...(options.query ? [{ label: "Best match", sort: "match", order: "asc" }] : []),
    { label: "Name A–Z", sort: "name", order: "asc" },
    { label: "Name Z–A", sort: "name", order: "desc" },
    ...(player ? [
      { label: "Highest prestige", sort: "prestige", order: "desc" },
      { label: "Lowest prestige", sort: "prestige", order: "asc" },
      { label: "Largest roster", sort: "roster", order: "desc" },
      { label: "Smallest roster", sort: "roster", order: "asc" },
    ] : [
      { label: "Most members", sort: "members", order: "desc" },
      { label: "Fewest members", sort: "members", order: "asc" },
    ]),
  ];
  const current = choices.find(choice => choice.sort === options.sort && (choice.sort === "match" || choice.order === options.order)) ?? choices[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={controlClass} aria-label={"Sort results: " + current.label}>
          {current.label}<ChevronDown className="size-3.5 text-slate-400" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 border-slate-700 bg-slate-900 text-slate-100">
        {choices.map(({ label, sort, order }) => (
          <DropdownMenuItem key={label} asChild>
            <Link href={"/search" + buildSearchParams(params, { tab, [scope + "Sort"]: sort, [scope + "Order"]: order, [scope + "Page"]: undefined })} aria-current={label === current.label ? "true" : undefined} className="justify-between">
              {label}{label === current.label && <Check className="size-3.5 text-indigo-200" aria-hidden="true" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlayerControls({ options, params }: { options: NormalizedPlayerSearch; params: DirectorySearchParams }) {
  const count = Number(!!options.allianceQuery) + Number(options.roster !== "all") + Number(options.battlegroup !== "all");
  return (
    <>
      {count > 0 && <ClearFilters href={"/search" + buildSearchParams(params, { tab: "players", playerAllianceQuery: undefined, playerRoster: undefined, playerBattlegroup: undefined, playerPage: undefined })} />}
      <SortMenu tab="players" options={options} params={params} />
      <Filters tab="players" options={options} count={count}>
        <label className={fieldClass}>
          <span>Alliance</span><input name="playerAllianceQuery" defaultValue={options.allianceQuery} placeholder="Name or tag" className={inputClass} />
        </label>
        <FilterField label="Roster" name="playerRoster" value={options.roster} items={[["all", "All rosters"], ["with", "Has roster"], ["without", "No roster"]]} />
        <FilterField label="Battlegroup" name="playerBattlegroup" value={options.battlegroup} items={[["all", "All groups"], ["1", "BG 1"], ["2", "BG 2"], ["3", "BG 3"], ["none", "No BG"]]} />
      </Filters>
    </>
  );
}

function AllianceControls({ options, params }: { options: NormalizedAllianceSearch; params: DirectorySearchParams }) {
  const count = Number(options.members !== "all") + Number(options.access !== "all");
  return (
    <>
      {count > 0 && <ClearFilters href={"/search" + buildSearchParams(params, { tab: "alliances", allianceMembers: undefined, allianceAccess: undefined, alliancePage: undefined })} />}
      <SortMenu tab="alliances" options={options} params={params} />
      <Filters tab="alliances" options={options} count={count}>
        <FilterField label="Members" name="allianceMembers" value={options.members} items={[["all", "All sizes"], ["1-10", "1–10"], ["11-30", "11–30"], ["31-plus", "31+"]]} />
        <FilterField label="Access" name="allianceAccess" value={options.access} items={[["all", "All access"], ["open", "Open"], ["invite-only", "Invite only"]]} />
      </Filters>
    </>
  );
}

function ClearFilters({ href }: { href: string }) {
  return <Link href={href} className={controlClass}>Clear filters <X className="size-3.5" aria-hidden="true" /></Link>;
}

function ResultHeading({ count, label, query }: { count: number; label: "player" | "alliance" | "result"; query: string }) {
  return (
    <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
      {count.toLocaleString("en-US")} {label}{count === 1 ? "" : "s"}{query && <> for <span className="break-all">“{query}”</span></>}
    </h2>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="border-t border-slate-800 py-7 text-sm text-slate-400">
      <p className="font-medium text-slate-200">{label}</p>
      <p className="mt-1">Try a different name or adjust your filters.</p>
    </div>
  );
}

function ColumnLabels({ labels }: { labels: string[] }) {
  return (
    <div aria-hidden="true" className={cn(rowGrid, "hidden border-b border-slate-800 px-2 pb-2 text-xs text-slate-400 md:grid")}>
      {labels.map(label => <span key={label}>{label}</span>)}<span />
    </div>
  );
}

function RowMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1 md:block">
      <dt className="order-last text-[11px] text-slate-400 md:sr-only">{label}</dt>
      <dd className="font-medium tabular-nums text-slate-200 md:text-sm">{value}</dd>
    </div>
  );
}

function PlayerRow({ player, compact = false }: { player: PlayerResult; compact?: boolean }) {
  const prestige = player.championPrestige?.toLocaleString("en-US") ?? "—";
  const alliance = player.alliance;
  return (
    <li>
      <Link href={`/player/${player.id}`} className={cn(rowAction, compact ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2" : rowGrid)}>
        <div className={rowIdentity}>
          <Avatar className="size-9 shrink-0 rounded-lg border border-slate-700 bg-slate-800">
            <AvatarImage src={player.avatar ?? undefined} alt="" />
            <AvatarFallback className="rounded-lg bg-slate-800 text-[11px] font-semibold text-indigo-100">{player.ingameName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-snug text-slate-100">
              <span className="break-words [overflow-wrap:anywhere]">{player.ingameName}</span>
              {player.isOfficer && <span title="Officer"><Crown className="size-3 shrink-0 text-amber-300" aria-hidden="true" /><span className="sr-only">Officer</span></span>}
            </h3>
            <p className="mt-0.5 break-words text-xs leading-snug text-slate-400 [overflow-wrap:anywhere]">
              {alliance ? (alliance.tag ? `[${alliance.tag}] ` : "") + alliance.name : "Unaffiliated"}
            </p>
          </div>
        </div>
        {compact ? (
          <span className="text-right text-xs font-semibold tabular-nums text-slate-200">{prestige}<small className="block font-normal text-slate-400">prestige</small></span>
        ) : (
          <>
            <dl className={rowMetrics}>
              <RowMetric label="prestige" value={prestige} />
              <RowMetric label="champs" value={player._count.roster.toLocaleString("en-US")} />
              <RowMetric label="battlegroup" value={player.battlegroup ? "BG " + player.battlegroup : "No BG"} />
            </dl>
            <ChevronRight className="col-start-2 row-start-1 size-3.5 text-slate-500 md:col-start-5" aria-hidden="true" />
          </>
        )}
      </Link>
    </li>
  );
}

function AllianceRow({ alliance, compact = false }: { alliance: AllianceResult; compact?: boolean }) {
  const { bg1, bg2, bg3, unassigned } = alliance.bgCounts;
  const access = <span className={cn("text-xs font-medium", alliance.inviteOnly ? "text-amber-300" : "text-emerald-300")}>{alliance.inviteOnly ? "Invite only" : "Open"}</span>;
  return (
    <li>
      <Link href={`/alliance/${alliance.id}`} className={cn(rowAction, compact ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2" : rowGrid)}>
        <div className={rowIdentity}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"><Shield className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold leading-snug text-slate-100 [overflow-wrap:anywhere]">{alliance.name}</h3>
            {(!compact || alliance.tag) && (
              <p className="mt-0.5 break-words text-xs leading-snug text-slate-400 [overflow-wrap:anywhere]">
                {alliance.tag && `[${alliance.tag}]`}
                {!compact && `${alliance.tag ? " · " : ""}BG ${bg1} / ${bg2} / ${bg3}${unassigned ? ` · ${unassigned} unassigned` : ""}`}
              </p>
            )}
            {!compact && alliance.description && <p className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-slate-300">{alliance.description}</p>}
          </div>
        </div>
        {compact ? (
          <span className="text-right text-xs tabular-nums text-slate-200">
            <span className="block font-medium">{alliance.memberCount.toLocaleString("en-US")} {alliance.memberCount === 1 ? "member" : "members"}</span>{access}
          </span>
        ) : (
          <>
            <dl className={rowMetrics}>
              <RowMetric label="members" value={alliance.memberCount.toLocaleString("en-US")} />
              <RowMetric label="avg. prestige" value={alliance.averageChampionPrestige?.toLocaleString("en-US") ?? "—"} />
              <div><dt className="sr-only">Access</dt><dd>{access}</dd></div>
            </dl>
            <ChevronRight className="col-start-2 row-start-1 size-3.5 text-slate-500 md:col-start-5" aria-hidden="true" />
          </>
        )}
      </Link>
    </li>
  );
}

function DirectoryPagination({
  params,
  pageParam,
  page,
  pageSize,
  totalCount,
}: {
  params: DirectorySearchParams;
  pageParam: string;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const { windowStart, windowEnd } = computePaginationWindow(page, totalPages);

  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={page > 1 ? buildSearchParams(params, { [pageParam]: String(page - 1) }) : "#"}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {Array.from({ length: windowEnd - windowStart + 1 }, (_, index) => windowStart + index).map((pageNumber) => (
          <PaginationItem key={pageNumber}>
            <PaginationLink
              href={buildSearchParams(params, { [pageParam]: String(pageNumber) })}
              isActive={pageNumber === page}
            >
              {pageNumber}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href={page < totalPages ? buildSearchParams(params, { [pageParam]: String(page + 1) }) : "#"}
            className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
