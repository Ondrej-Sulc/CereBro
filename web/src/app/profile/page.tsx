import { prisma } from "@/lib/prisma";
import { getRoster, RosterWithChampion } from "@cerebro/core/services/rosterService";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getChampionImageUrl } from "@/lib/championHelper";
import Image from "next/image";
import { ChampionClass } from "@prisma/client"; // Import ChampionClass
import { getChampionClassColors } from "@/lib/championClassHelper"; // Import class colors helper
import { cn } from "@/lib/utils"; // Import cn
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { PrestigeHistoryChart } from "./prestige-chart";

const CLASS_ICONS: Record<ChampionClass, string> = {
    SCIENCE: "/icons/Science.png",
    SKILL: "/icons/Skill.png",
    MYSTIC: "/icons/Mystic.png",
    COSMIC: "/icons/Cosmic.png",
    TECH: "/icons/Tech.png",
    MUTANT: "/icons/Mutant.png",
    SUPERIOR: "/icons/Superior.png"
};

export default async function ProfilePage() {
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/profile");
  }

  const [rosterResult, prestigeHistory] = await Promise.all([
    getRoster(player.id, null, null, null),
    prisma.prestigeLog.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, championPrestige: true, summonerPrestige: true, relicPrestige: true },
    })
  ]);

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

      {/* Prestige Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="lg:col-span-1 grid grid-cols-1 gap-4">
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

        {/* History Chart */}
        <div className="lg:col-span-2">
            {prestigeHistory.length >= 3 ? (
                <PrestigeHistoryChart data={prestigeHistory} />
            ) : (
                <Card className="bg-slate-900/30 border-slate-800 border-dashed h-full flex items-center justify-center p-8 text-center">
                    <div className="space-y-2">
                        <p className="text-slate-500 text-sm">Prestige history will appear here once you have at least three data points.</p>
                        <p className="text-slate-600 text-xs italic">Updates are recorded when you sync your roster.</p>
                    </div>
                </Card>
            )}
        </div>
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
                                        .map(([className, count]) => {
                                            const classColors = getChampionClassColors(className as ChampionClass);
                                            return (
                                                <Badge key={className} variant="outline" className={cn("flex items-center gap-1", classColors.border, "bg-slate-950/50")}>
                                                    <div className="relative w-4 h-4">
                                                        <Image src={CLASS_ICONS[className as ChampionClass]} alt={className} fill className="object-contain" />
                                                    </div>
                                                    <span className={cn("capitalize", classColors.text)}>{className.toLowerCase()}</span>
                                                    <span className="ml-1.5 text-slate-400 border-l border-slate-700 pl-1.5">{count}</span>
                                                </Badge>
                                            );
                                        })
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
