import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Shield, Users, Trophy, LayoutGrid, Crown, ArrowRight, UserRound, Swords } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  normalizeDirectoryTab,
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
type DiscoveryResult = Awaited<ReturnType<typeof getDefaultDiscovery>>;

export default async function DirectorySearchPage({ searchParams }: SearchPageProps) {
  const currentUser = await getUserPlayerWithAlliance();
  if (!currentUser) {
    redirect("/api/auth/discord-login?redirectTo=/search");
  }

  const params = await searchParams;
  const tab = normalizeDirectoryTab(params);
  const playerOptions = normalizePlayerSearch(params);
  const allianceOptions = normalizeAllianceSearch(params);
  const showPlayerDiscovery = shouldShowPlayerDiscovery(playerOptions);
  const showAllianceDiscovery = shouldShowAllianceDiscovery(allianceOptions);
  const [playerResults, allianceResults, discovery] = await Promise.all([
    tab === "players" ? getPlayerResults(playerOptions) : Promise.resolve(null),
    tab === "alliances" ? getAllianceResults(allianceOptions) : Promise.resolve(null),
    (tab === "players" && showPlayerDiscovery) || (tab === "alliances" && showAllianceDiscovery)
      ? getDefaultDiscovery()
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Search</h1>
            <p className="text-sm text-slate-400">Find player profiles and real alliances in CereBro.</p>
          </div>
        </div>
      </div>

      <DirectorySearchBox
        key={`${tab}:${tab === "players" ? playerOptions.query : allianceOptions.query}`}
        activeTab={tab}
        initialValue={tab === "players" ? playerOptions.query : allianceOptions.query}
      />

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1 shadow-inner">
        <TabLink tab="players" activeTab={tab} params={params} icon={<Users className="h-4 w-4" />}>
          Players
        </TabLink>
        <TabLink tab="alliances" activeTab={tab} params={params} icon={<Shield className="h-4 w-4" />}>
          Alliances
        </TabLink>
      </div>

      {tab === "players" ? (
        <PlayerSearchPanel params={params} options={playerOptions} result={playerResults!} discovery={showPlayerDiscovery ? discovery : null} />
      ) : (
        <AllianceSearchPanel params={params} options={allianceOptions} result={allianceResults!} discovery={showAllianceDiscovery ? discovery : null} />
      )}
    </div>
  );
}

async function getPlayerResults(options: NormalizedPlayerSearch) {
  const where = buildPlayerSearchWhere(options);
  const orderBy = buildPlayerSearchOrderBy(options);
  const shouldRank = options.query.length > 0;
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
    .map((alliance) => {
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
    })
    .filter((alliance) => allianceMemberFilterMatches(alliance.memberCount, options.members))
    .sort((a, b) => {
      if (options.query) {
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
  const [players, allianceRows] = await Promise.all([
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
      take: 4,
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
      take: 4,
    }),
  ]);

  return {
    players,
    alliances: allianceRows.map(toAllianceResult),
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

function shouldShowPlayerDiscovery(options: NormalizedPlayerSearch) {
  return !options.query && !options.allianceQuery && options.roster === "all" && options.battlegroup === "all" && options.page === 1;
}

function shouldShowAllianceDiscovery(options: NormalizedAllianceSearch) {
  return !options.query && options.members === "all" && options.access === "all" && options.page === 1;
}

function TabLink({
  tab,
  activeTab,
  params,
  icon,
  children,
}: {
  tab: DirectorySearchTab;
  activeTab: DirectorySearchTab;
  params: DirectorySearchParams;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = tab === activeTab;
  return (
    <Link
      href={buildSearchParams(params, { tab })}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-base font-bold transition-colors",
        active
          ? "border-sky-500/60 bg-sky-500/15 text-sky-100 shadow-[0_0_20px_rgba(14,165,233,0.10)]"
          : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function PlayerSearchPanel({
  params,
  options,
  result,
  discovery,
}: {
  params: DirectorySearchParams;
  options: NormalizedPlayerSearch;
  result: { players: PlayerResult[]; totalCount: number };
  discovery: DiscoveryResult | null;
}) {
  return (
    <div className="space-y-5">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(160px,1fr)_minmax(130px,.7fr)_minmax(110px,.55fr)_minmax(120px,.6fr)_minmax(100px,.5fr)_minmax(110px,auto)]" action="/search">
            <input type="hidden" name="tab" value="players" />
            <input type="hidden" name="playerQuery" value={options.query} />
            <FilterInput name="playerAllianceQuery" label="Alliance" placeholder="Name or tag" defaultValue={options.allianceQuery} />
            <FilterSelect name="playerRoster" label="Roster" value={options.roster} options={[
              ["all", "All rosters"],
              ["with", "Has roster"],
              ["without", "No roster"],
            ]} />
            <FilterSelect name="playerBattlegroup" label="BG" value={options.battlegroup} options={[
              ["all", "All BGs"],
              ["none", "No BG"],
              ["1", "BG 1"],
              ["2", "BG 2"],
              ["3", "BG 3"],
            ]} />
            <FilterSelect name="playerSort" label="Sort" value={options.sort} options={[
              ["name", "Name"],
              ["prestige", "Prestige"],
              ["roster", "Roster"],
            ]} />
            <FilterSelect name="playerOrder" label="Order" value={options.order} options={[
              ["asc", "Asc"],
              ["desc", "Desc"],
            ]} />
            <div className="flex flex-col justify-end">
              <div className="h-[18px] hidden xl:block" />
              <Button className="h-10 w-full gap-2" type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {discovery && (
        <DefaultDiscovery discovery={discovery} activeTab="players" />
      )}

      <ResultHeader count={result.totalCount} label="player profile" />

      {result.players.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {result.players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      ) : (
        <EmptyState label="No player profiles found." />
      )}

      <DirectoryPagination params={params} pageParam="playerPage" page={options.page} pageSize={options.pageSize} totalCount={result.totalCount} />
    </div>
  );
}

function AllianceSearchPanel({
  params,
  options,
  result,
  discovery,
}: {
  params: DirectorySearchParams;
  options: NormalizedAllianceSearch;
  result: { alliances: AllianceResult[]; totalCount: number };
  discovery: DiscoveryResult | null;
}) {
  return (
    <div className="space-y-5">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(170px,.8fr)_minmax(170px,.8fr)_minmax(150px,.7fr)_minmax(120px,.55fr)_minmax(110px,auto)]" action="/search">
            <input type="hidden" name="tab" value="alliances" />
            <input type="hidden" name="allianceQuery" value={options.query} />
            <FilterSelect name="allianceMembers" label="Members" value={options.members} options={[
              ["all", "All sizes"],
              ["1-10", "1-10"],
              ["11-30", "11-30"],
              ["31-plus", "31+"],
            ]} />
            <FilterSelect name="allianceAccess" label="Access" value={options.access} options={[
              ["all", "All access"],
              ["open", "Open"],
              ["invite-only", "Invite only"],
            ]} />
            <FilterSelect name="allianceSort" label="Sort" value={options.sort} options={[
              ["name", "Name"],
              ["members", "Members"],
            ]} />
            <FilterSelect name="allianceOrder" label="Order" value={options.order} options={[
              ["asc", "Asc"],
              ["desc", "Desc"],
            ]} />
            <div className="flex flex-col justify-end">
              <div className="h-[18px] hidden xl:block" />
              <Button className="h-10 w-full gap-2" type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {discovery && (
        <DefaultDiscovery discovery={discovery} activeTab="alliances" />
      )}

      <ResultHeader count={result.totalCount} label="alliance" />

      {result.alliances.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {result.alliances.map((alliance) => (
            <AllianceCard key={alliance.id} alliance={alliance} />
          ))}
        </div>
      ) : (
        <EmptyState label="No alliances found." />
      )}

      <DirectoryPagination params={params} pageParam="alliancePage" page={options.page} pageSize={options.pageSize} totalCount={result.totalCount} />
    </div>
  );
}

function DefaultDiscovery({
  discovery,
  activeTab,
}: {
  discovery: NonNullable<DiscoveryResult>;
  activeTab: DirectorySearchTab;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Discovery</h2>
          <p className="text-sm text-slate-400">
            Start with high-signal profiles and open alliances, or type above to search directly.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-slate-700 text-slate-400">
          {activeTab === "players" ? "Player focus" : "Alliance focus"}
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DiscoveryColumn
          title="Top player profiles"
          description="Roster-backed profiles ranked by champion prestige."
          icon={<Trophy className="h-4 w-4 text-amber-300" />}
        >
          <div className="grid gap-3">
            {discovery.players.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </DiscoveryColumn>

        <DiscoveryColumn
          title="Open alliances"
          description="Real alliances that currently accept join requests."
          icon={<Shield className="h-4 w-4 text-emerald-300" />}
        >
          <div className="grid gap-3">
            {discovery.alliances.map((alliance) => (
              <AllianceCard key={alliance.id} alliance={alliance} />
            ))}
          </div>
        </DiscoveryColumn>
      </div>
    </div>
  );
}

function DiscoveryColumn({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PlayerCard({ player }: { player: PlayerResult }) {
  const initials = player.ingameName.substring(0, 2).toUpperCase();
  return (
    <Link href={`/player/${player.id}`} className="group block h-full">
      <Card className="h-full overflow-hidden border-slate-800 bg-slate-900/55 transition-colors hover:border-sky-700/60">
        <CardContent className="p-0">
          <div className="relative border-b border-slate-800 bg-slate-950/55 p-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-sky-500/60 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 shrink-0 border border-slate-700 ring-4 ring-slate-950">
                <AvatarImage src={player.avatar ?? undefined} />
                <AvatarFallback className="bg-slate-800 text-sm font-black">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-lg font-black leading-tight text-white group-hover:text-sky-200">
                    {player.ingameName}
                  </h2>
                  {player.isOfficer && (
                    <Badge className="shrink-0 border border-amber-600/40 bg-amber-500/10 px-1.5 py-0 text-[9px] font-black text-amber-300">
                      <Crown className="mr-1 h-3 w-3" />
                      Officer
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-400">
                  {player.alliance ? (
                    <span className="truncate">
                      {player.alliance.tag ? `[${player.alliance.tag}] ` : ""}
                      {player.alliance.name}
                    </span>
                  ) : (
                    <span className="text-slate-500">Unaffiliated</span>
                  )}
                </div>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-500 transition-colors group-hover:border-sky-700/50 group-hover:text-sky-300">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-3">
            <Metric icon={<Trophy className="h-4 w-4" />} label="Prestige" value={player.championPrestige?.toLocaleString("en-US") ?? "N/A"} tone="amber" />
            <Metric icon={<LayoutGrid className="h-4 w-4" />} label="Roster" value={player._count.roster.toLocaleString("en-US")} tone="sky" />
            <Metric icon={<Swords className="h-4 w-4" />} label="Group" value={player.battlegroup ? `BG ${player.battlegroup}` : "No BG"} tone="slate" />
          </div>

          {player.alliance && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs">
              <span className="min-w-0 truncate text-slate-500">Alliance page</span>
              <span className="shrink-0 text-sky-300">Open profile</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function AllianceCard({ alliance }: { alliance: AllianceResult }) {
  const accessTone = alliance.inviteOnly ? "amber" : "emerald";
  return (
    <Link href={`/alliance/${alliance.id}`} className="group block h-full">
      <Card className="h-full overflow-hidden border-slate-800 bg-slate-900/55 transition-colors hover:border-emerald-700/50">
        <CardContent className="p-0">
          <div className="relative border-b border-slate-800 bg-slate-950/55 p-4">
            <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500/50 opacity-70" />
            <div className="flex items-start gap-4 pl-1">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-emerald-300 ring-4 ring-slate-950">
                <Shield className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {alliance.tag && (
                    <span className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-xs font-black text-slate-300">
                      [{alliance.tag}]
                    </span>
                  )}
                  <h2 className="truncate text-lg font-black leading-tight text-white group-hover:text-emerald-200">
                    {alliance.name}
                  </h2>
                </div>
                {alliance.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{alliance.description}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No public description</p>
                )}
              </div>
              <AccessBadge inviteOnly={alliance.inviteOnly} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            <Metric icon={<Users className="h-4 w-4" />} label="Members" value={alliance.memberCount.toLocaleString("en-US")} tone="emerald" />
            <Metric icon={<Trophy className="h-4 w-4" />} label="Avg prestige" value={alliance.averageChampionPrestige?.toLocaleString("en-US") ?? "N/A"} tone="amber" />
            <Metric icon={<LayoutGrid className="h-4 w-4" />} label="BG split" value={`${alliance.bgCounts.bg1}/${alliance.bgCounts.bg2}/${alliance.bgCounts.bg3}`} tone="sky" />
            <Metric icon={<UserRound className="h-4 w-4" />} label="No BG" value={alliance.bgCounts.unassigned.toLocaleString("en-US")} tone="slate" />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs">
            <span className={cn(
              "font-semibold",
              accessTone === "amber" ? "text-amber-300" : "text-emerald-300",
            )}>
              {alliance.inviteOnly ? "Officer invite required" : "Accepts join requests"}
            </span>
            <span className="flex items-center gap-1 text-emerald-300">
              Open alliance
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function AccessBadge({ inviteOnly }: { inviteOnly: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 font-bold",
        inviteOnly
          ? "border-amber-700/70 bg-amber-500/10 text-amber-300"
          : "border-emerald-700/70 bg-emerald-500/10 text-emerald-300",
      )}
    >
      {inviteOnly ? "Invite only" : "Open"}
    </Badge>
  );
}

function FilterInput({ name, label, placeholder, defaultValue }: { name: string; label: string; placeholder: string; defaultValue: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-400">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-sky-700"
      />
    </label>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-400">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition-colors focus:border-sky-700"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ResultHeader({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-400">
        {count.toLocaleString("en-US")} {label}{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "slate" | "sky" | "amber" | "emerald";
}) {
  const toneClass = {
    slate: "border-slate-800 bg-slate-950/55 text-slate-400",
    sky: "border-sky-900/50 bg-sky-950/20 text-sky-300",
    amber: "border-amber-900/50 bg-amber-950/20 text-amber-300",
    emerald: "border-emerald-900/50 bg-emerald-950/20 text-emerald-300",
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-lg border p-2.5", toneClass)}>
      <div className="flex items-center gap-1.5 opacity-80">
        {icon}
        <span className="truncate text-[10px] font-black uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 truncate font-mono text-base font-black text-slate-100">{value}</div>
    </div>
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
