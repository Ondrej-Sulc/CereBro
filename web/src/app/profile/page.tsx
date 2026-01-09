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
import { Upload, LayoutGrid } from "lucide-react";

const CLASS_ICONS: Record<Exclude<ChampionClass, 'SUPERIOR'>, string> = {
    SCIENCE: "/icons/Science.png",
    SKILL: "/icons/Skill.png",
    MYSTIC: "/icons/Mystic.png",
    COSMIC: "/icons/Cosmic.png",
    TECH: "/icons/Tech.png",
    MUTANT: "/icons/Mutant.png",
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
        <div className="flex flex-wrap gap-3">
            <Link href="/profile/roster">
                <Button variant="outline" className="text-slate-200 border-slate-700 hover:bg-slate-800 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    View Full Roster
                </Button>
            </Link>
            <Link href="/profile/update">
                <Button className="bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-900/20 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Update Roster
                </Button>
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
                // Group by Rank then Class
                const statsByRank = champions.reduce((acc, c) => {
                    if (!acc[c.rank]) acc[c.rank] = { total: 0 } as Record<ChampionClass | 'total', number>;
                    acc[c.rank][c.champion.class] = (acc[c.rank][c.champion.class] || 0) + 1;
                    acc[c.rank].total += 1;
                    return acc;
                }, {} as Record<number, Record<ChampionClass | 'total', number>>);

                const ranks = Object.keys(statsByRank).map(Number).sort((a, b) => b - a);
                const classOrder: Exclude<ChampionClass, 'SUPERIOR'>[] = ["SCIENCE", "SKILL", "MUTANT", "TECH", "COSMIC", "MYSTIC"];

                // Calculate Class Totals for this Star Level
                const classTotals = champions.reduce((acc, c) => {
                    acc[c.champion.class] = (acc[c.champion.class] || 0) + 1;
                    return acc;
                }, {} as Record<ChampionClass, number>);

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
                        <CardContent className="p-0">
                           <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-slate-950/50 text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Rank</th>
                                            {classOrder.map(cls => (
                                                <th key={cls} className="px-4 py-3 text-center">
                                                    <div className="flex justify-center items-center" title={cls}>
                                                         <div className="relative w-5 h-5 opacity-80">
                                                            <Image src={CLASS_ICONS[cls]} alt={cls} fill className="object-contain" />
                                                        </div>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-center font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {ranks.map(rank => {
                                            const rowStats = statsByRank[rank];
                                            return (
                                                <tr key={rank} className="hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-slate-200">
                                                        <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700">R{rank}</Badge>
                                                    </td>
                                                    {classOrder.map(cls => {
                                                        const count = rowStats[cls] || 0;
                                                        const classColors = getChampionClassColors(cls);
                                                        return (
                                                            <td key={cls} className="px-4 py-3 text-center">
                                                                {count > 0 ? (
                                                                    <span className={cn("font-medium", classColors.text)}>{count}</span>
                                                                ) : (
                                                                    <span className="text-slate-700">-</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-3 text-center font-bold text-slate-200">
                                                        {rowStats.total}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total Row */}
                                        <tr className="bg-slate-950/30 font-bold border-t-2 border-slate-800">
                                            <td className="px-4 py-3 text-slate-400 uppercase text-xs tracking-wider">Total</td>
                                            {classOrder.map(cls => {
                                                const count = classTotals[cls] || 0;
                                                const classColors = getChampionClassColors(cls);
                                                return (
                                                    <td key={cls} className="px-4 py-3 text-center">
                                                        {count > 0 ? (
                                                            <span className={cn(classColors.text)}>{count}</span>
                                                        ) : (
                                                            <span className="text-slate-700">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 text-center text-white">
                                                {champions.length}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
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
