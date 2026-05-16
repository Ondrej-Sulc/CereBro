import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { startOfDay, subDays } from "date-fns";
import { Activity, AlertTriangle, Camera, CheckCircle2, Clock, ShieldCheck, UserCircle, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { ALLIANCE_UNLOCK_THRESHOLD_MINOR, FREE_SCREENSHOT_MONTHLY_LIMIT, PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR } from "@cerebro/core/services/rosterScreenshotQuotaService";
import { ensureAdmin } from "../actions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TimeframeSelector } from "../insights/timeframe-selector";
import { LastUpdated } from "../insights/last-updated";
import { PlayerUsageFilter } from "./player-usage-filter";

export const metadata: Metadata = {
  title: "Usage - CereBro Admin",
  description: "Review roster screenshot processing usage across web and Discord.",
};

type UsagePageProps = {
  searchParams: Promise<{ days?: string; playerId?: string }>;
};

function parseDays(raw: string | undefined): number {
  const parsed = raw ? parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 3650 ? parsed : 30;
}

function formatNumber(value: number | bigint | null | undefined): string {
  return Number(value ?? 0).toLocaleString();
}

function formatEuroMinor(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format((value ?? 0) / 100);
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "n/a";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function percent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function getPlayerUsageRole(event: { actorPlayerId: string | null; targetPlayerId: string | null }, playerId: string): string {
  const isActor = event.actorPlayerId === playerId;
  const isTarget = event.targetPlayerId === playerId;
  if (isActor && isTarget) return "Actor + target";
  if (isActor) return "Actor";
  if (isTarget) return "Target";
  return "Related";
}

export default async function UsagePage({ searchParams }: UsagePageProps) {
  await ensureAdmin("VIEW_INSIGHTS");

  const { days: rawDays, playerId } = await searchParams;
  const days = parseDays(rawDays);
  const startDate = startOfDay(subDays(new Date(), days));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastUpdated = new Date().toISOString();
  const playerUsageWhere: Prisma.RosterUploadEventWhereInput | null = playerId
    ? {
        createdAt: { gte: startDate },
        OR: [{ actorPlayerId: playerId }, { targetPlayerId: playerId }],
      }
    : null;

  const [
    totals,
    activeActors,
    activeAlliances,
    sourceRows,
    topAllianceRows,
    topActorRows,
    recentProblemEvents,
    selectedPlayer,
    playerUsageTotals,
    playerUsageActorCount,
    playerUsageTargetCount,
    playerUsageRows,
    recentPlayerEvents,
  ] = await Promise.all([
    prisma.rosterUploadEvent.aggregate({
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: {
        fileCount: true,
        visionRequestCount: true,
        processedChampionCount: true,
        errorCount: true,
      },
      _avg: { durationMs: true },
    }),
    prisma.rosterUploadEvent.findMany({
      where: { createdAt: { gte: startDate }, actorPlayerId: { not: null } },
      distinct: ["actorPlayerId"],
      select: { actorPlayerId: true },
    }),
    prisma.rosterUploadEvent.findMany({
      where: { createdAt: { gte: startDate }, allianceId: { not: null } },
      distinct: ["allianceId"],
      select: { allianceId: true },
    }),
    prisma.rosterUploadEvent.groupBy({
      by: ["source", "mode", "status"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: {
        fileCount: true,
        visionRequestCount: true,
        processedChampionCount: true,
        errorCount: true,
      },
      orderBy: [{ source: "asc" }, { mode: "asc" }, { status: "asc" }],
    }),
    prisma.rosterUploadEvent.groupBy({
      by: ["allianceId"],
      where: { createdAt: { gte: startDate }, allianceId: { not: null } },
      _count: { id: true },
      _sum: { fileCount: true, visionRequestCount: true, processedChampionCount: true },
      orderBy: { _sum: { fileCount: "desc" } },
      take: 10,
    }),
    prisma.rosterUploadEvent.groupBy({
      by: ["actorPlayerId"],
      where: { createdAt: { gte: startDate }, actorPlayerId: { not: null } },
      _count: { id: true },
      _sum: { fileCount: true, visionRequestCount: true, processedChampionCount: true },
      orderBy: { _sum: { fileCount: "desc" } },
      take: 10,
    }),
    prisma.rosterUploadEvent.findMany({
      where: {
        createdAt: { gte: startDate },
        OR: [{ status: "failed" }, { status: "partial" }],
      },
      select: {
        id: true,
        createdAt: true,
        source: true,
        mode: true,
        status: true,
        fileCount: true,
        errorCount: true,
        errorMessages: true,
        actorPlayer: { select: { id: true, ingameName: true } },
        targetPlayer: { select: { id: true, ingameName: true } },
        alliance: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    playerId
      ? prisma.player.findUnique({
          where: { id: playerId },
          select: {
            id: true,
            ingameName: true,
            avatar: true,
            alliance: { select: { id: true, name: true } },
          },
        })
      : null,
    playerUsageWhere
      ? prisma.rosterUploadEvent.aggregate({
          where: playerUsageWhere,
          _count: { id: true },
          _sum: {
            fileCount: true,
            visionRequestCount: true,
            processedChampionCount: true,
            successCount: true,
            errorCount: true,
          },
          _avg: { durationMs: true },
        })
      : null,
    playerId
      ? prisma.rosterUploadEvent.count({
          where: { createdAt: { gte: startDate }, actorPlayerId: playerId },
        })
      : 0,
    playerId
      ? prisma.rosterUploadEvent.count({
          where: { createdAt: { gte: startDate }, targetPlayerId: playerId },
        })
      : 0,
    playerUsageWhere
      ? prisma.rosterUploadEvent.groupBy({
          by: ["source", "mode", "status"],
          where: playerUsageWhere,
          _count: { id: true },
          _sum: {
            fileCount: true,
            visionRequestCount: true,
            processedChampionCount: true,
            errorCount: true,
          },
          orderBy: [{ source: "asc" }, { mode: "asc" }, { status: "asc" }],
        })
      : [],
    playerUsageWhere
      ? prisma.rosterUploadEvent.findMany({
          where: playerUsageWhere,
          select: {
            id: true,
            createdAt: true,
            source: true,
            mode: true,
            status: true,
            fileCount: true,
            visionRequestCount: true,
            processedChampionCount: true,
            errorCount: true,
            durationMs: true,
            errorMessages: true,
            actorPlayerId: true,
            targetPlayerId: true,
            actorPlayer: { select: { id: true, ingameName: true } },
            targetPlayer: { select: { id: true, ingameName: true } },
            alliance: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : [],
  ]);

  const allianceIds = topAllianceRows.map((row) => row.allianceId).filter((id): id is string => !!id);
  const actorIds = topActorRows.map((row) => row.actorPlayerId).filter((id): id is string => !!id);

  const [alliances, actors, currentMonthAllianceDonations] = await Promise.all([
    allianceIds.length
      ? prisma.alliance.findMany({
          where: { id: { in: allianceIds } },
          select: { id: true, name: true },
        })
      : [],
    actorIds.length
      ? prisma.player.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, ingameName: true, alliance: { select: { name: true } } },
        })
      : [],
    allianceIds.length
      ? prisma.supportDonation.findMany({
          where: {
            status: "succeeded",
            createdAt: { gte: monthStart, lt: monthEnd },
            player: { allianceId: { in: allianceIds } },
          },
          select: {
            amountMinor: true,
            player: { select: { allianceId: true } },
          },
        })
      : [],
  ]);

  const allianceNameById = new Map(alliances.map((alliance) => [alliance.id, alliance.name]));
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const allianceDonationMinorById = new Map<string, number>();
  for (const donation of currentMonthAllianceDonations) {
    const allianceId = donation.player?.allianceId;
    if (!allianceId) continue;
    allianceDonationMinorById.set(
      allianceId,
      (allianceDonationMinorById.get(allianceId) ?? 0) + donation.amountMinor
    );
  }

  const totalBatches = totals._count.id;
  const totalFiles = totals._sum.fileCount ?? 0;
  const totalErrors = totals._sum.errorCount ?? 0;
  const activeActorCount = activeActors.length;
  const averageFilesPerActor = activeActorCount > 0 ? totalFiles / activeActorCount : 0;
  const failedBatchCount = sourceRows
    .filter((row) => row.status === "failed")
    .reduce((sum, row) => sum + row._count.id, 0);
  const partialBatchCount = sourceRows
    .filter((row) => row.status === "partial")
    .reduce((sum, row) => sum + row._count.id, 0);
  const playerUsageBatchCount = playerUsageTotals?._count.id ?? 0;
  const playerUsageFailedBatchCount = playerUsageRows
    .filter((row) => row.status === "failed")
    .reduce((sum, row) => sum + row._count.id, 0);
  const playerUsagePartialBatchCount = playerUsageRows
    .filter((row) => row.status === "partial")
    .reduce((sum, row) => sum + row._count.id, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
          <p className="text-muted-foreground">
            Roster screenshot processing volume across web and Discord.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="h-10 w-[180px] rounded-md bg-muted animate-pulse" />}>
            <TimeframeSelector currentDays={days} />
          </Suspense>
          <LastUpdated createdAtIso={lastUpdated} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Player Usage Search</CardTitle>
          <CardDescription>Find upload batches submitted by a player or targeting that player&apos;s roster.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-10 w-full rounded-md bg-muted animate-pulse md:w-[320px]" />}>
            <PlayerUsageFilter selectedPlayerName={selectedPlayer?.ingameName ?? ""} />
          </Suspense>
        </CardContent>
      </Card>

      {playerId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedPlayer?.avatar || ""} alt={selectedPlayer?.ingameName ?? "Selected player"} />
                  <AvatarFallback>
                    <UserCircle className="h-7 w-7" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>
                    {selectedPlayer ? (
                      <Link href={`/player/${selectedPlayer.id}`} className="hover:underline">
                        {selectedPlayer.ingameName}
                      </Link>
                    ) : (
                      "Player not found"
                    )}
                  </CardTitle>
                  <CardDescription>
                    {selectedPlayer?.alliance ? (
                      <Link href={`/admin/alliances/${selectedPlayer.alliance.id}`} className="hover:underline">
                        {selectedPlayer.alliance.name}
                      </Link>
                    ) : selectedPlayer ? (
                      "No alliance"
                    ) : (
                      "The selected player id does not match an existing profile."
                    )}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="w-fit">
                Last {days} days
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedPlayer ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Screenshots</p>
                    <p className="text-2xl font-bold">{formatNumber(playerUsageTotals?._sum.fileCount)}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(playerUsageBatchCount)} batches</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Vision Requests</p>
                    <p className="text-2xl font-bold">{formatNumber(playerUsageTotals?._sum.visionRequestCount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(playerUsageTotals?._sum.processedChampionCount)} champions
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Role Split</p>
                    <p className="text-2xl font-bold">{formatNumber(playerUsageActorCount)} / {formatNumber(playerUsageTargetCount)}</p>
                    <p className="text-xs text-muted-foreground">actor / target batches</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Processing Health</p>
                    <p className="text-2xl font-bold">{formatDuration(Math.round(playerUsageTotals?._avg.durationMs ?? 0))}</p>
                    <p className="text-xs text-muted-foreground">
                      {percent(playerUsageFailedBatchCount + playerUsagePartialBatchCount, playerUsageBatchCount)} non-clean
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Errors</p>
                    <p className="text-2xl font-bold">{formatNumber(playerUsageTotals?._sum.errorCount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(playerUsageTotals?._sum.successCount)} successful files
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-lg border">
                    <div className="border-b p-4">
                      <h3 className="font-semibold">Player Breakdown</h3>
                      <p className="text-sm text-muted-foreground">Volume by source, mode, and outcome.</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Screenshots</TableHead>
                          <TableHead className="text-right">Batches</TableHead>
                          <TableHead className="text-right">Champions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {playerUsageRows.map((row) => (
                          <TableRow key={`${row.source}-${row.mode}-${row.status}`}>
                            <TableCell className="font-medium capitalize">{row.source}</TableCell>
                            <TableCell>{row.mode}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(row.status)}>{row.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(row._sum.fileCount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(row._count.id)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row._sum.processedChampionCount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {playerUsageRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                              No usage events recorded for this player in the selected period.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="rounded-lg border">
                    <div className="border-b p-4">
                      <h3 className="font-semibold">Recent Player Events</h3>
                      <p className="text-sm text-muted-foreground">Latest related upload batches.</p>
                    </div>
                    <div className="max-h-[520px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Players</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Files</TableHead>
                            <TableHead className="text-right">Duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentPlayerEvents.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {event.createdAt.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{getPlayerUsageRole(event, selectedPlayer.id)}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {event.actorPlayer?.ingameName ?? "Unknown"} → {event.targetPlayer?.ingameName ?? "Unknown"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {event.source} · {event.mode}
                                  {event.alliance ? ` · ${event.alliance.name}` : ""}
                                  {event.errorMessages.length > 0 ? ` · ${event.errorMessages[0]}` : ""}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusBadgeVariant(event.status)}>{event.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatNumber(event.fileCount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatDuration(event.durationMs)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {recentPlayerEvents.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                                No recent upload batches match this player.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Clear the player search or select another player to view detailed usage.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Screenshots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(totalFiles)}</p>
            <p className="text-xs text-muted-foreground">{formatNumber(totalBatches)} upload batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Vision Requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(totals._sum.visionRequestCount)}</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totals._sum.processedChampionCount)} champions processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Active Uploaders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(activeActorCount)}</p>
            <p className="text-xs text-muted-foreground">
              {averageFilesPerActor.toFixed(1)} screenshots/uploader, {formatNumber(activeAlliances.length)} alliances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Processing Health
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDuration(Math.round(totals._avg.durationMs ?? 0))}</p>
            <p className="text-xs text-muted-foreground">
              {percent(failedBatchCount + partialBatchCount, totalBatches)} non-clean batches, {formatNumber(totalErrors)} issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Quota Rules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{FREE_SCREENSHOT_MONTHLY_LIMIT}/month</p>
            <p className="text-xs text-muted-foreground">
              Personal lifetime unlock at {formatEuroMinor(PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR)}, alliance at {formatEuroMinor(ALLIANCE_UNLOCK_THRESHOLD_MINOR)}/month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
            <CardDescription>Volume by source, mode, and outcome.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Screenshots</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Champions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceRows.map((row) => (
                  <TableRow key={`${row.source}-${row.mode}-${row.status}`}>
                    <TableCell className="font-medium capitalize">{row.source}</TableCell>
                    <TableCell>{row.mode}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "success" ? "secondary" : "destructive"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row._sum.fileCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row._count.id)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row._sum.processedChampionCount)}
                    </TableCell>
                  </TableRow>
                ))}
                {sourceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No usage events recorded for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Alliances</CardTitle>
            <CardDescription>Highest screenshot volume in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alliance</TableHead>
                  <TableHead className="text-right">Screenshots</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Month Support</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Champions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topAllianceRows.map((row) => {
                  const currentMonthMinor = row.allianceId ? allianceDonationMinorById.get(row.allianceId) ?? 0 : 0;
                  const isUnlocked = currentMonthMinor >= ALLIANCE_UNLOCK_THRESHOLD_MINOR;
                  return (
                    <TableRow key={row.allianceId}>
                      <TableCell className="font-medium">
                        {row.allianceId ? (
                          <Link href={`/admin/alliances/${row.allianceId}`} className="hover:underline">
                            {allianceNameById.get(row.allianceId) ?? "Unknown alliance"}
                          </Link>
                        ) : (
                          "No alliance"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row._sum.fileCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row._sum.visionRequestCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEuroMinor(currentMonthMinor)}</TableCell>
                      <TableCell>
                        <Badge variant={isUnlocked ? "secondary" : "outline"}>
                          {isUnlocked ? "Unlocked" : "Locked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row._sum.processedChampionCount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {topAllianceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No alliance-linked usage yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Uploaders</CardTitle>
            <CardDescription>Actors who submitted the most screenshots.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Alliance</TableHead>
                  <TableHead className="text-right">Screenshots</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Champions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topActorRows.map((row) => {
                  const actor = row.actorPlayerId ? actorById.get(row.actorPlayerId) : null;
                  return (
                    <TableRow key={row.actorPlayerId}>
                      <TableCell className="font-medium">
                        {row.actorPlayerId ? (
                          <Link href={`/player/${row.actorPlayerId}`} className="hover:underline">
                            {actor?.ingameName ?? "Unknown player"}
                          </Link>
                        ) : (
                          "Unknown player"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{actor?.alliance?.name ?? "None"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row._sum.fileCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row._count.id)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row._sum.processedChampionCount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {topActorRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No actor-linked usage yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Issues</CardTitle>
            <CardDescription>Latest failed or partial processing batches.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProblemEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {event.status === "failed" ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium">
                        {event.actorPlayer?.ingameName ?? "Unknown"} → {event.targetPlayer?.ingameName ?? "Unknown"}
                      </span>
                    </div>
                    <Badge variant={event.status === "failed" ? "destructive" : "outline"}>{event.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {event.createdAt.toLocaleString()} · {event.source} · {event.mode} · {event.fileCount} screenshot(s)
                    {event.alliance ? ` · ${event.alliance.name}` : ""}
                  </div>
                  {event.errorMessages.length > 0 && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {event.errorMessages[0]}
                    </p>
                  )}
                </div>
              ))}
              {recentProblemEvents.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No failed or partial batches in this period.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
