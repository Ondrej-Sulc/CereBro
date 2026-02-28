import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Check, X, Settings, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { CleanupAlliancesButton } from "./cleanup-button"
import { computePaginationWindow } from "@/lib/pagination"

interface AdminAlliancesPageProps {
  searchParams: Promise<{
    query?: string
    page?: string
    pageSize?: string
    reminders?: string
    sortBy?: string
    order?: "asc" | "desc"
  }>
}

interface SortHeaderProps {
  field: string
  label: string
  sortBy: string
  order: string
  params: any
  className?: string
}

const SortHeader = ({ field, label, sortBy, order, params, className }: SortHeaderProps) => {
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

export default async function AdminAlliancesPage({ searchParams }: AdminAlliancesPageProps) {
  const params = await searchParams
  const query = params.query || ""
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || "20", 10) || 20))
  const remindersFilter = params.reminders
  
  // Whitelist sort fields and order
  const allowedSortFields = ["name", "members", "createdAt"]
  const sortBy = allowedSortFields.includes(params.sortBy || "") ? params.sortBy! : "name"
  const order = params.order === "desc" ? "desc" : "asc"

  const where: Prisma.AllianceWhereInput = {
    AND: [
      query ? {
        name: {
          contains: query,
          mode: 'insensitive'
        }
      } : {},
      remindersFilter === "active" ? { 
        aqReminderSettings: { 
          OR: [
            { section1ReminderEnabled: true },
            { section2ReminderEnabled: true },
            { finalReminderEnabled: true }
          ] 
        } 
      } : remindersFilter === "disabled" ? { 
        OR: [
          { aqReminderSettings: null },
          { 
            aqReminderSettings: { 
              section1ReminderEnabled: false, 
              section2ReminderEnabled: false, 
              finalReminderEnabled: false 
            } 
          }
        ] 
      } : {}
    ]
  }

  // Handle member count sorting specifically
  const orderBy: Prisma.AllianceOrderByWithRelationInput = sortBy === "members" 
    ? { members: { _count: order } }
    : { [sortBy]: order }

  const [alliances, totalCount] = await Promise.all([
    prisma.alliance.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: { members: true }
        },
        aqReminderSettings: true
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.alliance.count({ where })
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  const filters = [
    {
      name: "reminders",
      label: "AQ Reminders",
      pluralLabel: "AQ Reminders",
      options: [
        { label: "Active", value: "active" },
        { label: "Disabled", value: "disabled" }
      ]
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Alliances</h1>
          <CleanupAlliancesButton />
        </div>
        <Badge variant="outline" className="px-3 py-1 text-sm">
          {totalCount.toLocaleString()} Total Alliances
        </Badge>
      </div>

      <Suspense fallback={<div className="h-10 w-full bg-muted animate-pulse rounded-md" />}>
        <TableFilters placeholder="Search by name..." filters={filters} />
      </Suspense>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Alliance Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="name" label="Name" sortBy={sortBy} order={order} params={params} />
                <SortHeader field="members" label="Members" className="text-right" sortBy={sortBy} order={order} params={params} />
                <TableHead>AQ Reminders</TableHead>
                <TableHead>Features</TableHead>
                <SortHeader field="createdAt" label="Created" sortBy={sortBy} order={order} params={params} />
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alliances.map((alliance) => (
                <TableRow key={alliance.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>{alliance.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{alliance._count.members}</TableCell>
                  <TableCell>
                    {alliance.aqReminderSettings?.section1ReminderEnabled || 
                     alliance.aqReminderSettings?.section2ReminderEnabled || 
                     alliance.aqReminderSettings?.finalReminderEnabled ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        <Check className="mr-1 h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-100">
                        <X className="mr-1 h-3 w-3" /> Disabled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {alliance.enabledFeatureCommands.length} enabled
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(alliance.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/alliances/${alliance.id}`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Details
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {alliances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    No alliances found matching your search criteria.
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
                    const { windowStart, windowEnd } = computePaginationWindow(page, totalPages);
                    
                    return Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => {
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
