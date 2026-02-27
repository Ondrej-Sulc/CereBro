import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableFilters } from "../components/table-filters"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Prisma } from "@prisma/client"
import { Suspense } from "react"
import { buildSearchParams, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface AdminPlayersPageProps {
  searchParams: Promise<{
    query?: string
    page?: string
    pageSize?: string
    role?: string
    status?: string
    alliance?: string
    sortBy?: string
    order?: "asc" | "desc"
  }>
}

export default async function AdminPlayersPage({ searchParams }: AdminPlayersPageProps) {
  const params = await searchParams
  const query = params.query || ""
  const page = Math.max(1, parseInt(params.page || "1") || 1)
  const pageSize = Math.max(1, Math.min(100, parseInt(params.pageSize || "50") || 50))  
  const roleFilter = params.role
  const statusFilter = params.status
  const allianceId = params.alliance

  // Whitelist sort fields and order
  const allowedSortFields = ["createdAt", "ingameName", "summonerPrestige", "roster"]
  const sortBy = allowedSortFields.includes(params.sortBy || "") ? params.sortBy! : "createdAt"
  const order = params.order === "asc" ? "asc" : "desc"

  const conditions: Prisma.PlayerWhereInput[] = []

  if (query) {
    conditions.push({
      OR: [
        { ingameName: { contains: query, mode: 'insensitive' } },
        { discordId: { contains: query, mode: 'insensitive' } }
      ]
    })
  }

  if (roleFilter === "admin") {
    conditions.push({
      OR: [
        { isBotAdmin: true },
        { botUser: { isBotAdmin: true } }
      ]
    })
  } else if (roleFilter === "officer") {
    conditions.push({ isOfficer: true })
  } else if (roleFilter === "trusted") {
    conditions.push({ isTrustedUploader: true })
  }

  if (statusFilter === "active") {
    conditions.push({ isActive: true })
  } else if (statusFilter === "inactive") {
    conditions.push({ isActive: false })
  }

  if (allianceId) {
    conditions.push({ allianceId })
  }

  const where: Prisma.PlayerWhereInput = conditions.length > 0 ? { AND: conditions } : {}

  const orderBy: Prisma.PlayerOrderByWithRelationInput = sortBy === "roster" 
    ? { roster: { _count: order } }
    : { [sortBy]: order }

  const [players, totalCount, alliances] = await Promise.all([
    prisma.player.findMany({
      where,
      orderBy,
      include: {
        alliance: true,
        botUser: true,
        _count: {
          select: { roster: true }
        }
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.player.count({ where }),
    prisma.alliance.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 100 // Limit for performance in filter
    })
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  const filters = [
    {
      name: "role",
      label: "Role",
      pluralLabel: "Roles",
      options: [
        { label: "Bot Admin", value: "admin" },
        { label: "Officer", value: "officer" },
        { label: "Trusted Uploader", value: "trusted" }
      ]
    },
    {
      name: "status",
      label: "Status",
      pluralLabel: "Statuses",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" }
      ]
    },
    {
        name: "alliance",
        label: "Alliance",
        pluralLabel: "Alliances",
        options: alliances.map(a => ({ label: a.name, value: a.id }))
    }
  ]

  const SortHeader = ({ field, label, className }: { field: string, label: string, className?: string }) => {
    const isActive = sortBy === field
    const nextOrder = isActive && order === "asc" ? "desc" : "asc"
    const Icon = !isActive ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown

    return (
      <TableHead className={cn("p-0", className)}>
        <Button 
          variant="ghost" 
          size="sm" 
          asChild 
          className={cn(
            "h-8 w-full justify-start font-bold hover:bg-transparent px-2",
            isActive && "text-primary"
          )}
        >
          <Link href={buildSearchParams(params, { sortBy: field, order: nextOrder, page: "1" })}>
            {label}
            <Icon className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </TableHead>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Players</h1>
        <Badge variant="outline" className="px-3 py-1 text-sm">
          {totalCount.toLocaleString()} Total Profiles
        </Badge>
      </div>

      <Suspense fallback={<div className="h-10 w-full bg-muted animate-pulse rounded-md" />}>
        <TableFilters placeholder="Search by name or Discord ID..." filters={filters} />
      </Suspense>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Player Profiles Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="ingameName" label="Player Profile" />
                <TableHead>Alliance</TableHead>
                <SortHeader field="summonerPrestige" label="Prestige" />
                <TableHead>Status/Role</TableHead>
                <SortHeader field="roster" label="Roster" />
                <SortHeader field="createdAt" label="Joined" className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={player.avatar || ""} />
                        <AvatarFallback><UserCircle className="h-5 w-5" /></AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span>{player.ingameName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{player.discordId}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {player.alliance ? (
                      <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5">
                        {player.alliance.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unaffiliated</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                        <span className="font-medium">S: {player.summonerPrestige?.toLocaleString() || "-"}</span>
                        <span className="text-muted-foreground text-[10px]">C: {player.championPrestige?.toLocaleString() || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {(player.isBotAdmin || player.botUser?.isBotAdmin) && (
                           <Badge className="bg-purple-500 text-white text-[10px] h-5 px-1.5">
                                Admin
                           </Badge>
                        )}
                        {player.isOfficer && (
                           <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-5 px-1.5">
                                Officer
                           </Badge>
                        )}
                        {!player.isActive && (
                           <Badge variant="outline" className="text-red-500 border-red-200 text-[10px] h-5 px-1.5">
                                Inactive
                           </Badge>
                        )}
                        {player.isTrustedUploader && (
                           <Badge variant="outline" className="text-blue-500 border-blue-200 text-[10px] h-5 px-1.5">
                                Trusted
                           </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">
                        {player._count.roster}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(player.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {players.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    No players found matching your search criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} results
              </p>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href={page > 1 ? buildSearchParams(params, { page: (page - 1).toString() }) : "#"} 
                      className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {(() => {
                    const windowSize = Math.min(5, totalPages);
                    const half = Math.floor(windowSize / 2);
                    const windowStart = Math.max(1, Math.min(page - half, totalPages - windowSize + 1));
                    return Array.from({ length: windowSize }, (_, i) => {
                      const pageNum = windowStart + i;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href={buildSearchParams(params, { page: pageNum.toString() })}
                            isActive={page === pageNum}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    });
                  })()}

                  {totalPages > 5 && page < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext 
                      href={page < totalPages ? buildSearchParams(params, { page: (page + 1).toString() }) : "#"} 
                      className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

