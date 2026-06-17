import type { Metadata } from "next";
import Link from "next/link";
import { DuelStatus } from "@prisma/client";
import { Search } from "lucide-react";
import { ensureAdmin } from "../actions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DuelImportPanel } from "./duel-import-panel";
import { DuelTableClient, DuelTableRow } from "./duel-table-client";
import {
  buildDuelWhere,
  DUEL_PAGE_SIZE,
  duelSourceOptions,
  duelStatusOptions,
  getDuelPage,
  getDuelSourceFilter,
  getDuelStatusFilter,
  normalizeDuelFilter,
} from "./filters";

export const metadata: Metadata = {
  title: "Duel Management - CereBro",
  description: "Import, review, and bulk manage community duel targets.",
};

export const dynamic = "force-dynamic";

interface AdminDuelsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSingleParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildFilterHref(status: string, source: string, q: string) {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("source", source);
  if (q) params.set("q", q);
  return `/admin/duels?${params.toString()}`;
}

const statusLabels: Record<DuelStatus, string> = {
  ACTIVE: "Active",
  SUGGESTED: "Suggested",
  OUTDATED: "Outdated",
  ARCHIVED: "Archived",
};

export default async function AdminDuelsPage({ searchParams }: AdminDuelsPageProps) {
  await ensureAdmin("MANAGE_CHAMPIONS");

  const resolvedSearchParams = await searchParams;
  const filter = normalizeDuelFilter({
    status: getDuelStatusFilter(getSingleParam(resolvedSearchParams, "status")),
    source: getDuelSourceFilter(getSingleParam(resolvedSearchParams, "source")),
    q: getSingleParam(resolvedSearchParams, "q"),
  });
  const page = getDuelPage(getSingleParam(resolvedSearchParams, "page"));
  const where = buildDuelWhere(filter);

  const [duels, total, statusCounts, champions] = await Promise.all([
    prisma.duel.findMany({
      where,
      include: {
        champion: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * DUEL_PAGE_SIZE,
      take: DUEL_PAGE_SIZE,
    }),
    prisma.duel.count({ where }),
    prisma.duel.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.champion.findMany({
      where: { isPlayable: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const countByStatus = new Map(statusCounts.map((item) => [item.status, item._count]));
  const pageCount = Math.max(1, Math.ceil(total / DUEL_PAGE_SIZE));
  const tableRows: DuelTableRow[] = duels.map((duel) => ({
    id: duel.id,
    playerName: duel.playerName,
    rank: duel.rank,
    source: duel.source,
    status: duel.status,
    submittedByDiscordId: duel.submittedByDiscordId,
    createdAt: duel.createdAt.toISOString(),
    updatedAt: duel.updatedAt.toISOString(),
    champion: duel.champion,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duel Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Import source data, review suggested targets, and clean up outdated duel records in bulk.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.values(DuelStatus).map((status) => (
            <div key={status} className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">{statusLabels[status]}</div>
              <div className="text-lg font-semibold">{(countByStatus.get(status) ?? 0).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <DuelImportPanel />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {duelStatusOptions.map((status) => (
            <Button
              key={status}
              asChild
              size="sm"
              variant={filter.status === status ? "secondary" : "outline"}
            >
              <Link href={buildFilterHref(status, filter.source, filter.q)}>
                {status === "all" ? "All" : statusLabels[status as DuelStatus]}
              </Link>
            </Button>
          ))}
        </div>

        <form className="grid gap-3 md:grid-cols-[180px_minmax(240px,1fr)_auto_auto]" action="/admin/duels">
          <input type="hidden" name="status" value={filter.status} />
          <select
            name="source"
            defaultValue={filter.source}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {duelSourceOptions.map((source) => (
              <option key={source} value={source}>
                {source === "all" ? "All Sources" : source}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={filter.q}
              placeholder="Search champion, player, rank, or Discord ID"
              className="pl-9"
            />
          </div>
          <Button type="submit">Filter</Button>
          <Button asChild variant="outline">
            <Link href="/admin/duels">Reset</Link>
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{total.toLocaleString()} matching</Badge>
          <span>Status: {filter.status}</span>
          <span>Source: {filter.source}</span>
          {filter.q && <span>Search: &quot;{filter.q}&quot;</span>}
        </div>
      </div>

      <DuelTableClient
        duels={tableRows}
        champions={champions}
        filter={filter}
        total={total}
        page={page}
        pageCount={pageCount}
      />
    </div>
  );
}
