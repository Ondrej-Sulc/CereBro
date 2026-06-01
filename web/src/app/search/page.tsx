import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Shield, Users, Trophy, LayoutGrid, Crown } from "lucide-react";
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
  buildPlayerSearchOrderBy,
  buildPlayerSearchWhere,
  normalizeAllianceSearch,
  normalizeDirectoryTab,
  normalizePlayerSearch,
  paginate,
  type DirectorySearchParams,
  type DirectorySearchTab,
  type NormalizedAllianceSearch,
  type NormalizedPlayerSearch,
} from "@/lib/directory-search";
import { computePaginationWindow } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { buildSearchParams, cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Search - CereBro",
  description: "Search CereBro player profiles and alliances.",
};

type SearchPageProps = {
  searchParams: Promise<DirectorySearchParams>;
};

type PlayerResult = Awaited<ReturnType<typeof getPlayerResults>>["players"][number];
type AllianceResult = Awaited<ReturnType<typeof getAllianceResults>>["alliances"][number];

export default async function DirectorySearchPage({ searchParams }: SearchPageProps) {
  const currentUser = await getUserPlayerWithAlliance();
  if (!currentUser) {
    redirect("/api/auth/discord-login?redirectTo=/search");
  }

  const params = await searchParams;
  const tab = normalizeDirectoryTab(params);
  const playerOptions = normalizePlayerSearch(params);
  const allianceOptions = normalizeAllianceSearch(params);
  const [playerResults, allianceResults] = await Promise.all([
    tab === "players" ? getPlayerResults(playerOptions) : Promise.resolve(null),
    tab === "alliances" ? getAllianceResults(allianceOptions) : Promise.resolve(null),
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

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1 shadow-inner">
        <TabLink tab="players" activeTab={tab} params={params} icon={<Users className="h-4 w-4" />}>
          Players
        </TabLink>
        <TabLink tab="alliances" activeTab={tab} params={params} icon={<Shield className="h-4 w-4" />}>
          Alliances
        </TabLink>
      </div>

      {tab === "players" ? (
        <PlayerSearchPanel params={params} options={playerOptions} result={playerResults!} />
      ) : (
        <AllianceSearchPanel params={params} options={allianceOptions} result={allianceResults!} />
      )}
    </div>
  );
}

async function getPlayerResults(options: NormalizedPlayerSearch) {
  const where = buildPlayerSearchWhere(options);
  const orderBy = buildPlayerSearchOrderBy(options);
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
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.player.count({ where }),
  ]);

  return { players, totalCount };
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
}: {
  params: DirectorySearchParams;
  options: NormalizedPlayerSearch;
  result: { players: PlayerResult[]; totalCount: number };
}) {
  return (
    <div className="space-y-5">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(180px,1.3fr)_minmax(160px,1fr)_minmax(130px,.7fr)_minmax(110px,.55fr)_minmax(120px,.6fr)_minmax(100px,.5fr)_minmax(110px,auto)]" action="/search">
            <input type="hidden" name="tab" value="players" />
            <FilterInput name="playerQuery" label="Player" placeholder="Search player name" defaultValue={options.query} />
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
            <div className="flex items-end">
              <Button className="w-full gap-2" type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
}: {
  params: DirectorySearchParams;
  options: NormalizedAllianceSearch;
  result: { alliances: AllianceResult[]; totalCount: number };
}) {
  return (
    <div className="space-y-5">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-4">
          <form className="grid gap-3 lg:grid-cols-[1.4fr_170px_170px_150px_120px_auto]" action="/search">
            <input type="hidden" name="tab" value="alliances" />
            <FilterInput name="allianceQuery" label="Alliance" placeholder="Search name or tag" defaultValue={options.query} />
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
            <div className="flex items-end">
              <Button className="w-full gap-2" type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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

function PlayerCard({ player }: { player: PlayerResult }) {
  return (
    <Card className="border-slate-800 bg-slate-900/50 transition-colors hover:border-slate-700">
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-12 w-12 border border-slate-700">
          <AvatarImage src={player.avatar ?? undefined} />
          <AvatarFallback>{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/player/${player.id}`} className="truncate font-semibold text-white hover:text-sky-300">
              {player.ingameName}
            </Link>
            {player.isOfficer && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {player.alliance ? (
              <Link href={`/alliance/${player.alliance.id}`} className="hover:text-sky-300">
                {player.alliance.tag ? `[${player.alliance.tag}] ` : ""}
                {player.alliance.name}
              </Link>
            ) : (
              <span>Unaffiliated</span>
            )}
            <span className="text-slate-700">/</span>
            <span>{player._count.roster.toLocaleString()} champs</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-300">
            {player.battlegroup ? `BG ${player.battlegroup}` : "No BG"}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            {player.championPrestige?.toLocaleString("en-US") ?? "N/A"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AllianceCard({ alliance }: { alliance: AllianceResult }) {
  return (
    <Card className="border-slate-800 bg-slate-900/50 transition-colors hover:border-slate-700">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {alliance.tag && <span className="font-mono text-sm font-bold text-slate-400">[{alliance.tag}]</span>}
              <Link href={`/alliance/${alliance.id}`} className="truncate font-semibold text-white hover:text-sky-300">
                {alliance.name}
              </Link>
            </div>
            {alliance.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">{alliance.description}</p>
            )}
          </div>
          <Badge variant="outline" className={cn("shrink-0", alliance.inviteOnly ? "border-amber-700 text-amber-300" : "border-emerald-700 text-emerald-300")}>
            {alliance.inviteOnly ? "Invite only" : "Open"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Metric icon={<Users className="h-4 w-4" />} label="Members" value={alliance.memberCount.toLocaleString("en-US")} />
          <Metric icon={<Trophy className="h-4 w-4" />} label="Avg prestige" value={alliance.averageChampionPrestige?.toLocaleString("en-US") ?? "N/A"} />
          <Metric icon={<LayoutGrid className="h-4 w-4" />} label="BGs" value={`${alliance.bgCounts.bg1}/${alliance.bgCounts.bg2}/${alliance.bgCounts.bg3}`} />
          <Metric icon={<Users className="h-4 w-4" />} label="No BG" value={alliance.bgCounts.unassigned.toLocaleString("en-US")} />
        </div>
      </CardContent>
    </Card>
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 p-2">
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 font-mono text-sm font-bold text-slate-200">{value}</div>
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
