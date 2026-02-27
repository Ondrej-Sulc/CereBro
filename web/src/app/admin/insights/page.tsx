import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Shield, UserPlus, Activity, ExternalLink } from "lucide-react"
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

export default async function InsightsPage() {
  const [
    totalPlayers,
    totalAlliances,
    playersInAlliances,
    topAlliances,
    recentPlayers,
    topPrestigePlayers
  ] = await Promise.all([
    prisma.player.count(),
    prisma.alliance.count(),
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
    })
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Database Insights</h1>
        <div className="text-sm text-muted-foreground italic">
           Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlayers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Registered in CereBro</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alliances</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAlliances.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active alliances</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Affiliated Players</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playersInAlliances.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {((playersInAlliances / Math.max(totalPlayers, 1)) * 100).toFixed(1)}% of all players
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Alliance Size</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalAlliances > 0 ? (playersInAlliances / totalAlliances).toFixed(1) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Players per alliance</p>
          </CardContent>
        </Card>
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

