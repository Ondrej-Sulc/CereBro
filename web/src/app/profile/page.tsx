import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRoster, RosterWithChampion } from "@cerebro/core/services/rosterService";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getChampionImageUrl } from "@/lib/championHelper";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/profile");
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });

  if (!account?.providerAccountId) {
    return <div className="p-8 text-center text-red-400">Could not resolve Discord Account.</div>;
  }

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId, isActive: true },
    include: { alliance: true },
  });

  if (!player) {
    return (
      <div className="container mx-auto p-8 max-w-4xl text-center space-y-4">
        <h1 className="text-3xl font-bold">Profile Not Found</h1>
        <p className="text-slate-400">
          You are not registered with CereBro. Please use the <code className="bg-slate-800 px-1 py-0.5 rounded">/register</code> command in Discord or join an alliance.
        </p>
      </div>
    );
  }

  const rosterResult = await getRoster(player.id, null, null, null);
  const roster = typeof rosterResult === "string" ? [] : rosterResult;

  // Roster Analysis
  const byStar = roster.reduce((acc, entry) => {
    if (!acc[entry.stars]) acc[entry.stars] = [];
    acc[entry.stars].push(entry);
    return acc;
  }, {} as Record<number, RosterWithChampion[]>);

  const starLevels = Object.keys(byStar)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-5xl space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            {player.ingameName}
            {player.isActive && <Badge variant="secondary" className="text-xs">Active</Badge>}
          </h1>
          <p className="text-slate-400 mt-1">
            {player.alliance ? `Alliance: ${player.alliance.name}` : "No Alliance"} • Timezone: {player.timezone || "Not set"}
          </p>
        </div>
        <div className="flex gap-2">
            <Link href="/profile/update">
                <Button className="bg-sky-600 hover:bg-sky-700">Update Roster</Button>
            </Link>
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Prestige Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Summoner Prestige</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{player.summonerPrestige?.toLocaleString() || "N/A"}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Champion Prestige</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{player.championPrestige?.toLocaleString() || "N/A"}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Relic Prestige</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{player.relicPrestige?.toLocaleString() || "N/A"}</div>
            </CardContent>
        </Card>
      </div>

      {/* Roster Summary */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">Roster Summary</h2>
        
        {roster.length === 0 ? (
            <Card className="bg-slate-900/30 border-slate-800 border-dashed p-8 text-center">
                <p className="text-slate-400 mb-4">No champions found in your roster.</p>
                <Link href="/profile/update">
                    <Button variant="outline">Upload Screenshots</Button>
                </Link>
            </Card>
        ) : (
            starLevels.map((stars) => {
                const champions = byStar[stars];
                // Rank Stats
                const byRank = champions.reduce((acc, c) => {
                    acc[c.rank] = (acc[c.rank] || 0) + 1;
                    return acc;
                }, {} as Record<number, number>);
                
                // Class Stats
                const byClass = champions.reduce((acc, c) => {
                    acc[c.champion.class] = (acc[c.champion.class] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                return (
                    <Card key={stars} className="bg-slate-900/50 border-slate-800 overflow-hidden">
                        <CardHeader className="bg-slate-900/80 border-b border-slate-800 pb-3">
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <span className="text-yellow-500">{"★".repeat(stars)}</span>
                                    <span>{stars}-Star Champions</span>
                                    <Badge variant="outline" className="ml-2 bg-slate-800">{champions.length}</Badge>
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {/* Rank Distribution */}
                            <div>
                                <h4 className="text-xs uppercase font-semibold text-slate-500 mb-2">By Rank</h4>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(byRank)
                                        .sort(([r1], [r2]) => Number(r2) - Number(r1))
                                        .map(([rank, count]) => (
                                            <Badge key={rank} variant="secondary" className="bg-slate-800 hover:bg-slate-700">
                                                R{rank}: <span className="text-sky-400 ml-1">{count}</span>
                                            </Badge>
                                        ))
                                    }
                                </div>
                            </div>
                            
                             {/* Class Distribution */}
                             <div>
                                <h4 className="text-xs uppercase font-semibold text-slate-500 mb-2">By Class</h4>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(byClass)
                                        .sort(([, c1], [, c2]) => c2 - c1)
                                        .map(([className, count]) => (
                                            <Badge key={className} variant="outline" className="border-slate-700 bg-slate-950/50">
                                                <span className="capitalize">{className.toLowerCase()}</span>
                                                <span className="ml-1.5 text-slate-400 border-l border-slate-700 pl-1.5">{count}</span>
                                            </Badge>
                                        ))
                                    }
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })
        )}
      </div>
    </div>
  );
}
