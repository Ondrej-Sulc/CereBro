import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Shield, Users, Settings, UserCircle, Clock, MapPin, Hash, Check, X, ShieldAlert, Award } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MembersTable } from "./members-table"

interface AdminAllianceDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AdminAllianceDetailPage({ params }: AdminAllianceDetailPageProps) {
  const { id } = await params

  const alliance = await prisma.alliance.findUnique({
    where: { id },
    include: {
      _count: {
        select: { members: true }
      },
      config: true,
      aqReminderSettings: true,
      aqSchedules: true,
      activeDefensePlan: true
    }
  })

  if (!alliance) {
    notFound()
  }

  // Aggregate stats separately to avoid pulling full member objects
  const [prestigeStats, players] = await Promise.all([
    prisma.player.aggregate({
      where: { allianceId: id },
      _avg: { summonerPrestige: true }
    }),
    prisma.player.findMany({
      where: { allianceId: id },
      select: { _count: { select: { roster: true } } }
    })
  ]);

  const rosterStatsTotal = players.reduce((acc, p) => acc + p._count.roster, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{alliance.name}</h1>
            <p className="text-muted-foreground font-mono text-xs">{alliance.id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {alliance.guildId && (
             <Badge variant="outline" className="text-xs">
                Discord Server ID: {alliance.guildId}
             </Badge>
          )}
          <Badge variant="outline">
            {alliance._count.members} Members
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Prestige</CardTitle>
                <Award className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                   {prestigeStats._avg.summonerPrestige ? 
                    Math.round(prestigeStats._avg.summonerPrestige).toLocaleString() 
                    : "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Summoner Prestige avg.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Roster Size</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                    {rosterStatsTotal.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total champions tracked</p>
              </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Plan</CardTitle>
                  <MapPin className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold truncate">
                      {alliance.activeDefensePlan?.name || "None"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Selected war defense plan</p>
                </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Bot Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50">
                        <div className="flex items-center space-x-3">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Sheet Integrated</span>
                        </div>
                        {alliance.config?.sheetId ? <Badge className="bg-green-500">YES</Badge> : <Badge variant="outline">NO</Badge>}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50">
                        <div className="flex items-center space-x-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">AQ Reminders</span>
                        </div>
                        {(alliance.aqReminderSettings?.section1ReminderEnabled || alliance.aqReminderSettings?.section2ReminderEnabled || alliance.aqReminderSettings?.finalReminderEnabled) ? <Badge className="bg-blue-500">ACTIVE</Badge> : <Badge variant="outline">OFF</Badge>}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50">
                        <div className="flex items-center space-x-3">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Link Code</span>
                        </div>
                        <span className="font-mono text-sm">{alliance.linkCode || "No Link Code"}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                  <CardTitle className="text-lg">Features Enabled</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="flex flex-wrap gap-2">
                      {alliance.enabledFeatureCommands.length > 0 ? 
                        alliance.enabledFeatureCommands.map((feature) => (
                          <Badge key={feature} variant="secondary" className="px-2 py-1 text-xs">
                              {feature}
                          </Badge>
                        )) : (
                          <p className="text-sm text-muted-foreground">No special features enabled yet.</p>
                        )
                      }
                  </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Alliance Members</CardTitle>
              <CardDescription>
                Detailed list of all players currently affiliated with {alliance.name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <MembersTable allianceId={alliance.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Alliance Settings Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Discord Integration</h3>
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Officer Role ID:</span>
                                <span className="font-mono">{alliance.officerRole || "Not set"}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground">War Videos Channel:</span>
                                <span className="font-mono">{alliance.warVideosChannelId || "Not set"}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground">Death Channel:</span>
                                <span className="font-mono">{alliance.deathChannelId || "Not set"}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground">BG Roles (1/2/3):</span>
                                <span className="font-mono">{[alliance.battlegroup1Role, alliance.battlegroup2Role, alliance.battlegroup3Role].filter(Boolean).length || 0} configured</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground">BG Channels (1/2/3):</span>
                                <span className="font-mono">{[alliance.battlegroup1ChannelId, alliance.battlegroup2ChannelId, alliance.battlegroup3ChannelId].filter(Boolean).length || 0} configured</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Feature Toggles</h3>
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Create AQ Thread:</span>
                                <span>{alliance.createAqThread ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground">File Uploads:</span>
                                <span>{alliance.canUploadFiles ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground">Remove Missing Members:</span>
                                <span>{alliance.removeMissingMembers ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground">Active AQ Schedules:</span>
                                <span>{alliance.aqSchedules.length} configured</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
