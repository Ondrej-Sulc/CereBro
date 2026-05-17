import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Prisma, WarVideoStatus } from "@prisma/client";
import { Search, Video } from "lucide-react";
import { ensureAdmin } from "../actions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getYoutubeVideoId } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { WarVideoRowActions } from "./war-video-row-actions";

export const metadata: Metadata = {
  title: "War Video Queue - CereBro",
  description: "Review, approve, and reject submitted alliance war videos.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const statusOptions = [
  { label: "Pending", value: "UPLOADED" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Planning", value: "PLANNING" },
  { label: "All", value: "all" },
] as const;

const validStatuses = new Set<string>(["UPLOADED", "PUBLISHED", "REJECTED", "PLANNING", "all"]);

interface AdminWarVideosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSingleParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getStatusFilter(value: string | undefined) {
  if (!value || !validStatuses.has(value)) {
    return "UPLOADED";
  }

  return value;
}

function buildWarVideoWhere(status: string, query: string): Prisma.WarVideoWhereInput {
  const trimmedQuery = query.trim();
  const where: Prisma.WarVideoWhereInput = {};

  if (status !== "all") {
    where.status = status as WarVideoStatus;
  }

  if (trimmedQuery) {
    where.OR = [
      { submittedBy: { ingameName: { contains: trimmedQuery, mode: "insensitive" } } },
      { url: { contains: trimmedQuery, mode: "insensitive" } },
      { description: { contains: trimmedQuery, mode: "insensitive" } },
      { fights: { some: { player: { ingameName: { contains: trimmedQuery, mode: "insensitive" } } } } },
      { fights: { some: { war: { alliance: { name: { contains: trimmedQuery, mode: "insensitive" } } } } } },
      { fights: { some: { war: { enemyAlliance: { contains: trimmedQuery, mode: "insensitive" } } } } },
      { fights: { some: { attacker: { name: { contains: trimmedQuery, mode: "insensitive" } } } } },
      { fights: { some: { defender: { name: { contains: trimmedQuery, mode: "insensitive" } } } } },
    ];
  }

  return where;
}

function buildPageHref(searchParams: Record<string, string | string[] | undefined>, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value) {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/admin/war-videos?${query}` : "/admin/war-videos";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "UPLOADED":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "PUBLISHED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "REJECTED":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  }
}

function VideoThumbnail({ url }: { url: string | null }) {
  const youtubeId = getYoutubeVideoId(url);

  return (
    <div className="relative h-16 w-28 overflow-hidden rounded-md border bg-muted">
      {youtubeId ? (
        <Image
          src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
          alt="Video thumbnail"
          fill
          sizes="112px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Video className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type WarVideoQueueRow = Prisma.WarVideoGetPayload<{
  include: {
    submittedBy: true;
    fights: {
      include: {
        player: true;
        attacker: true;
        defender: true;
        node: true;
        war: { include: { alliance: true } };
      };
    };
  };
}>;

function getPrimaryFight(video: WarVideoQueueRow) {
  return [...video.fights].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber)[0];
}

export default async function AdminWarVideosPage({ searchParams }: AdminWarVideosPageProps) {
  await ensureAdmin("MANAGE_WAR_CONFIG");

  const resolvedSearchParams = await searchParams;
  const status = getStatusFilter(getSingleParam(resolvedSearchParams, "status"));
  const query = getSingleParam(resolvedSearchParams, "q")?.trim() || "";
  const requestedPage = Number.parseInt(getSingleParam(resolvedSearchParams, "page") || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where = buildWarVideoWhere(status, query);

  const [videos, total] = await Promise.all([
    prisma.warVideo.findMany({
      where,
      include: {
        submittedBy: true,
        fights: {
          include: {
            player: true,
            attacker: true,
            defender: true,
            node: true,
            war: { include: { alliance: true } },
          },
          orderBy: [{ node: { nodeNumber: "asc" } }, { createdAt: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.warVideo.count({ where }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">War Video Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review pending submissions and manage published or rejected war videos.
        </p>
      </div>

      <form className="grid gap-3 md:grid-cols-[180px_minmax(240px,1fr)_auto_auto]" action="/admin/war-videos">
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Search uploader, player, alliance, champion, URL, or description"
            className="pl-9"
          />
        </div>
        <Button type="submit">Filter</Button>
        <Button asChild variant="outline">
          <Link href="/admin/war-videos">Reset</Link>
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[132px]">Video</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploader</TableHead>
              <TableHead>War</TableHead>
              <TableHead>Fight</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => {
              const primaryFight = getPrimaryFight(video);
              const playerName = primaryFight?.player?.ingameName || video.submittedBy.ingameName;
              const fightCount = video.fights.length;

              return (
                <TableRow key={video.id}>
                  <TableCell>
                    <VideoThumbnail url={video.url} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={cn("w-fit", statusBadgeClass(video.status))}>
                        {video.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{video.visibility}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link href={`/player/${video.submittedBy.id}`} className="font-medium hover:text-sky-500">
                        {video.submittedBy.ingameName}
                      </Link>
                      <span className="text-xs text-muted-foreground">Video player: {playerName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {primaryFight ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{primaryFight.war.alliance.name}</span>
                        <span className="text-xs text-muted-foreground">
                          S{primaryFight.war.season} W{primaryFight.war.warNumber || "-"} T{primaryFight.war.warTier}
                          {primaryFight.war.enemyAlliance ? ` vs ${primaryFight.war.enemyAlliance}` : ""}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No fight data</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {primaryFight ? (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          Node {primaryFight.node.nodeNumber}: {primaryFight.attacker?.name || "?"} vs {primaryFight.defender?.name || "?"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {fightCount} {fightCount === 1 ? "fight" : "fights"}
                          {(primaryFight.battlegroup ?? 0) > 0 ? `, BG ${primaryFight.battlegroup}` : ""}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(video.createdAt)}
                  </TableCell>
                  <TableCell className="min-w-[320px]">
                    <WarVideoRowActions videoId={video.id} status={video.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {videos.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No war videos match the current filters.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {videos.length} of {total} videos
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
            <Link href={buildPageHref(resolvedSearchParams, page - 1)}>Previous</Link>
          </Button>
          <Button asChild variant="outline" size="sm" aria-disabled={page >= pageCount} className={cn(page >= pageCount && "pointer-events-none opacity-50")}>
            <Link href={buildPageHref(resolvedSearchParams, page + 1)}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
