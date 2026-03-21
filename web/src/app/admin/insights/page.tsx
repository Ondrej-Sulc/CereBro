import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
    Users, 
    Shield, 
    UserPlus, 
    Activity, 
    ExternalLink, 
    Sword, 
    Heart, 
    ArrowUpRight, 
    TrendingUp 
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { LastUpdated } from "./last-updated"
import { ensureAdmin } from "../actions"

export const metadata: Metadata = {
  title: "Database Insights - CereBro",
  description:
    "Monitor player, alliance, prestige, and recent join statistics across CereBro.",
}

import { GrowthCharts } from "./growth-charts"
import { getGrowthData, getRosterDistribution, getPrestigeDistribution } from "./growth-data"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { TimeframeSelector } from "./timeframe-selector"
import { subDays, startOfDay } from "date-fns"
import { Suspense } from "react"

export default async function InsightsPage(props: {
  searchParams: Promise<{ days?: string }>;
}) {
  const searchParams = await props.searchParams
  const rawDays = searchParams.days ? parseInt(searchParams.days, 10) : 30
  const days = (Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 3650) ? rawDays : 30
  const startDate = startOfDay(subDays(new Date(), days))
  
  await ensureAdmin("VIEW_INSIGHTS")
  const lastUpdated = new Date().toISOString()
  
  const [
    totalPlayers,
    newPlayers,
    totalAlliances,
    newAlliances,
    totalChampions,
    newChampions,
    totalDonations,
    periodDonations,
    playersInAlliances,
    topAlliances,
    recentPlayers,
    topPrestigePlayers,
    growthData,
    rosterDistribution,
    prestigeDistribution
  ] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { createdAt: { gte: startDate } } }),
    prisma.alliance.count(),
    prisma.alliance.count({ where: { createdAt: { gte: startDate } } }),
    prisma.roster.count(),
    prisma.roster.count({ where: { createdAt: { gte: startDate } } }),
    prisma.supportDonation.aggregate({
        where: { status: 'succeeded' },
        _sum: { amountMinor: true }
    }).then(res => (res._sum.amountMinor || 0) / 100),
    prisma.supportDonation.aggregate({
        where: { status: 'succeeded', createdAt: { gte: startDate } },
        _sum: { amountMinor: true }
    }).then(res => (res._sum.amountMinor || 0) / 100),
    prisma.player.count({
      where: { allianceId: { not: null } }
    }),
    prisma.alliance.findMany({
      take: 5,
      orderBy: {
        members: {
          _count: 'desc'
        }
      },
      include: {
        _count: {
          select: { members: true }
        }
      }
    }),
    prisma.player.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        alliance: true
      }
    }),
    prisma.player.findMany({
      take: 5,
      where: { summonerPrestige: { not: null } },
      orderBy: { summonerPrestige: 'desc' },
      include: { alliance: true }
    }),
    getGrowthData(days),
    getRosterDistribution(),
    getPrestigeDistribution()
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Database Insights</h1>
            <p className="text-muted-foreground mt-1">Platform growth, meta trends, and health metrics.</p>
        </div>
        <div className="flex items-center gap-3">
            <Suspense fallback={<div className="w-[180px] h-10 bg-muted animate-pulse rounded-md" />}>
                <TimeframeSelector currentDays={days} />
            </Suspense>
            <LastUpdated createdAtIso={lastUpdated} />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlayers.toLocaleString()}</div>
            <div className="flex items-center text-xs text-emerald-500 font-medium mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>+{newPlayers.toLocaleString()} in period</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alliances</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAlliances.toLocaleString()}</div>
            <div className="flex items-center text-xs text-emerald-500 font-medium mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>+{newAlliances.toLocaleString()} in period</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Champions</CardTitle>
            <Sword className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChampions.toLocaleString()}</div>
            <div className="flex items-center text-xs text-emerald-500 font-medium mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>+{newChampions.toLocaleString()} in period</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Support Revenue</CardTitle>
            <Heart className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDonations.toLocaleString()}</div>
            <div className="flex items-center text-xs text-emerald-500 font-medium mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>+${periodDonations.toLocaleString()} in period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Growth & Activity (Last {days} Days)</h2>
        </div>
        <GrowthCharts 
            growthData={growthData} 
            rosterDistribution={rosterDistribution} 
            prestigeDistribution={prestigeDistribution}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Largest Alliances</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                <Link href="/admin/alliances">
                    View All <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alliance</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topAlliances.map((alliance) => (
                  <TableRow key={alliance.id}>
                    <TableCell className="font-medium truncate max-w-[150px]">
                        <Link href={`/admin/alliances/${alliance.id}`} className="hover:underline">
                            {alliance.name}
                        </Link>
                    </TableCell>
                    <TableCell className="text-right">{alliance._count.members}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Top Prestige Players</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                <Link href="/admin/players">
                    View All <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Prestige</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPrestigePlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium truncate max-w-[150px]">
                        <div className="flex flex-col">
                            <span className="truncate">{player.ingameName}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{player.alliance?.name || "Unaffiliated"}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                        {player.summonerPrestige?.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Joins</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                <Link href="/admin/players">
                    View All <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">
                        <div className="flex flex-col">
                            <span className="truncate">{player.ingameName}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{player.alliance?.name || "Unaffiliated"}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(player.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

