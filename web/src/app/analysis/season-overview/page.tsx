import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skull, Trophy, AlertTriangle, Shield, Swords, Target, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeasonSelector } from "./season-selector";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ChampionImages } from "@/types/champion";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionClass } from "@prisma/client";

// Force dynamic rendering to ensure up-to-date data
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface PlayerStats {
  playerId: string;
  playerName: string;
  avatar: string | null;
  fights: number;
  deaths: number;
  battlegroup: number;
}

interface ChampionStat {
    id: number;
    name: string;
    class: ChampionClass;
    images: ChampionImages;
    count: number; // Usage count
    deaths: number; // Deaths caused (for defenders) or suffered (for attackers)
    fights: number; // Total fights involved in
}

interface NodeStat {
    nodeNumber: number;
    deaths: number;
    fights: number;
}

export default async function SeasonOverviewPage({ searchParams }: PageProps) {
  const awaitedSearchParams = await searchParams;

  // 1. Fetch available seasons
  const distinctSeasons = await prisma.war.findMany({
    distinct: ['season'],
    select: { season: true },
    orderBy: { season: 'desc' }
  });

  const seasons = distinctSeasons.map(s => s.season).filter(s => s !== 0);
  const latestSeason = seasons[0];

  const selectedSeason = awaitedSearchParams.season
    ? parseInt(awaitedSearchParams.season as string)
    : latestSeason;

    // 2. Fetch War Data
    const wars = await prisma.war.findMany({
      where: { 
        season: selectedSeason,
        status: { not: 'PLANNING' },
        warNumber: { not: null } // Exclude Offseason wars
      },
      include: {
        fights: {
          where: {
            player: { isNot: null }
          },
          include: {
            player: true,
            attacker: true,
            defender: true,
            node: true
          }
        }
      }
    });
  
    // 3. Process Data
    const bgStats: Record<number, Record<string, PlayerStats>> = {
      1: {},
      2: {},
      3: {}
    };
    
    const bgTotals: Record<number, { fights: number; deaths: number }> = {
      1: { fights: 0, deaths: 0 },
      2: { fights: 0, deaths: 0 },
      3: { fights: 0, deaths: 0 }
    };

    // Insight Aggregators
    const defenderStats = new Map<number, ChampionStat>();
    const attackerStats = new Map<number, ChampionStat>();
    const nodeStats = new Map<number, NodeStat>();
  
    let totalWars = wars.length;
    let mapTypes = new Set<string>();
  
    for (const war of wars) {
      mapTypes.add(war.mapType);
      for (const fight of war.fights) {
        if (!fight.player) continue;
        
        const bg = fight.battlegroup;
        if (!bg || bg < 1 || bg > 3) continue;
  
        // Player Stats
        const pid = fight.player.id;
        if (!bgStats[bg][pid]) {
          bgStats[bg][pid] = {
            playerId: pid,
            playerName: fight.player.ingameName,
            avatar: fight.player.avatar,
            fights: 0,
            deaths: 0,
            battlegroup: bg
          };
        }
        bgStats[bg][pid].fights += 1;
        bgStats[bg][pid].deaths += fight.death;
        
        bgTotals[bg].fights += 1;
        bgTotals[bg].deaths += fight.death;

        // Defender Stats
        if (fight.defender) {
            const defId = fight.defender.id;
            const existing = defenderStats.get(defId) || {
                id: defId,
                name: fight.defender.name,
                class: fight.defender.class,
                images: fight.defender.images as unknown as ChampionImages,
                count: 0,
                deaths: 0,
                fights: 0
            };
            existing.count += 1;
            existing.fights += 1;
            existing.deaths += fight.death;
            defenderStats.set(defId, existing);
        }

        // Attacker Stats
        if (fight.attacker) {
            const attId = fight.attacker.id;
            const existing = attackerStats.get(attId) || {
                id: attId,
                name: fight.attacker.name,
                class: fight.attacker.class,
                images: fight.attacker.images as unknown as ChampionImages,
                count: 0,
                deaths: 0,
                fights: 0
            };
            existing.count += 1; // Used
            existing.fights += 1;
            existing.deaths += fight.death; // Died while attacking
            attackerStats.set(attId, existing);
        }

        // Node Stats
        if (fight.node) {
            const nNum = fight.node.nodeNumber;
            const existing = nodeStats.get(nNum) || {
                nodeNumber: nNum,
                deaths: 0,
                fights: 0
            };
            existing.fights += 1;
            existing.deaths += fight.death;
            nodeStats.set(nNum, existing);
        }
      }
    }
  
    // Convert to arrays and sort for BG Tables
    const sortedBgs: Record<number, PlayerStats[]> = {};
    [1, 2, 3].forEach(bg => {
      const players = Object.values(bgStats[bg]);
      players.sort((a, b) => {
        if (a.deaths !== b.deaths) return a.deaths - b.deaths;
        return b.fights - a.fights;
      });
      sortedBgs[bg] = players;
    });

    // Sort Insights
    const topDefenders = Array.from(defenderStats.values())
        .sort((a, b) => b.deaths - a.deaths || b.fights - a.fights)
        .slice(0, 5);
    
    const topAttackers = Array.from(attackerStats.values())
        .sort((a, b) => b.count - a.count || a.deaths - b.deaths)
        .slice(0, 5);

    const hardestNodes = Array.from(nodeStats.values())
        .sort((a, b) => b.deaths - a.deaths || b.fights - a.fights)
        .slice(0, 5);
  
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-6">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Season Overview
                </h1>
            </div>
            <SeasonSelector seasons={seasons} currentSeason={selectedSeason} />
          </div>

          {/* Stats Overview Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1">
                 <span className="text-xs text-slate-500 uppercase font-medium">Season</span>
                 <span className="text-xl font-mono font-bold text-slate-200">{selectedSeason}</span>
              </Card>
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1">
                 <span className="text-xs text-slate-500 uppercase font-medium">Wars</span>
                 <span className="text-xl font-mono font-bold text-slate-200">{totalWars}</span>
              </Card>
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1">
                 <span className="text-xs text-slate-500 uppercase font-medium">Map Type</span>
                 <div className="flex items-center gap-2">
                     {mapTypes.has("BIG_THING") && mapTypes.has("STANDARD") ? (
                         <>
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-bold text-amber-500">Mixed</span>
                         </>
                     ) : mapTypes.has("BIG_THING") ? (
                         <>
                            <AlertTriangle className="h-4 w-4 text-purple-400" />
                            <span className="text-sm font-bold text-purple-400">Big Thing</span>
                         </>
                     ) : (
                         <span className="text-sm font-bold text-slate-400">Standard</span>
                     )}
                 </div>
              </Card>
          </div>
        </div>
  
        {/* Battlegroup Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(bg => {
            const totalFights = bgTotals[bg].fights;
            const totalDeaths = bgTotals[bg].deaths;
            const totalSoloRate = totalFights > 0 
              ? ((totalFights - totalDeaths) / totalFights) * 100 
              : 0;
  
            return (
              <Card key={bg} className="bg-slate-950/50 border-slate-800/60 flex flex-col">
                <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                  <CardTitle className="text-xl font-mono text-slate-200 flex items-center justify-between">
                    Battlegroup {bg}
                    <Badge variant="outline" className="bg-slate-900 text-slate-400 border-slate-700">
                      {sortedBgs[bg].length} Players
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/40 text-sm text-slate-400">
                    <span>Total Stats:</span>
                    <div className="flex gap-3">
                      <span className={cn(
                          "font-mono font-bold",
                          totalSoloRate >= 95 ? "text-emerald-400" : totalSoloRate >= 80 ? "text-slate-300" : "text-amber-500"
                      )}>
                          {totalSoloRate.toFixed(0)}%
                      </span>
                      <span className="font-mono flex items-center gap-1 text-red-400">
                          <Skull className="w-3.5 h-3.5" /> {totalDeaths}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-medium">
                        <tr>
                          <th className="px-2 py-3 w-8 text-center">#</th>
                          <th className="px-2 py-3">Player</th>
                          <th className="px-2 py-3 text-center">Fights</th>
                          <th className="px-2 py-3 text-center">Solo %</th>
                          <th className="px-2 py-3 text-center">Deaths</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-sm">
                        {sortedBgs[bg].map((player, index) => {
                          const rank = index + 1;
                          const isTop3 = rank <= 3;
                          const soloRate = player.fights > 0 
                            ? Math.max(0, ((player.fights - player.deaths) / player.fights) * 100) 
                            : 0;
                          
                          const deathColor = player.deaths === 0 
                            ? "text-emerald-400" 
                            : player.deaths < 3 
                              ? "text-slate-300" 
                              : "text-red-400";
  
                          return (
                            <tr key={player.playerId} className="group hover:bg-slate-800/20 transition-colors">
                              <td className="px-2 py-3 text-center font-mono text-slate-500">
                                {isTop3 ? (
                                    <span className={cn(
                                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                        rank === 1 && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
                                        rank === 2 && "bg-slate-400/20 text-slate-300 border border-slate-400/40",
                                        rank === 3 && "bg-amber-700/20 text-amber-600 border border-amber-700/40"
                                    )}>
                                        {rank}
                                    </span>
                                ) : (
                                    <span>{rank}</span>
                                )}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 border border-slate-700">
                                    <AvatarImage src={player.avatar || undefined} />
                                    <AvatarFallback className="text-[10px] bg-slate-800 text-slate-400">
                                      {player.playerName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className={cn("font-medium truncate max-w-[90px] sm:max-w-[120px]", isTop3 ? "text-slate-200" : "text-slate-400")}>
                                    {player.playerName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <span className="font-mono font-bold text-lg text-slate-200">
                                    {player.fights}
                                </span>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <span className={cn(
                                    "font-mono font-bold text-sm",
                                    soloRate >= 95 ? "text-emerald-400" : soloRate >= 80 ? "text-slate-300" : "text-amber-500"
                                )}>
                                    {soloRate.toFixed(0)}%
                                </span>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <span className={cn("inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm", deathColor, player.deaths > 0 && "bg-red-950/20 border border-red-900/30")}>
                                    {player.deaths > 0 && <Skull className="w-3.5 h-3.5" />}
                                    {player.deaths}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {sortedBgs[bg].length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                              No stats recorded for this battlegroup.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Season Insights */}
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-sky-400" />
                Season Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Deadly Defenders */}
                <Card className="bg-slate-950/50 border-slate-800/60">
                    <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                        <CardTitle className="text-lg font-mono text-slate-200 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-red-400" />
                            Deadliest Defenders
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-800/40">
                                {topDefenders.map((champ, i) => {
                                    const classColors = getChampionClassColors(champ.class);
                                    return (
                                    <tr key={champ.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3 w-8 text-slate-500 font-mono text-xs">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className={cn("h-8 w-8 border-none ring-1.5", classColors.border)}>
                                                    <AvatarImage src={getChampionImageUrl(champ.images, '64')} />
                                                    <AvatarFallback>{champ.name.substring(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                <span className={cn("font-bold truncate", classColors.text)}>
                                                    {champ.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-red-400 font-bold font-mono flex items-center gap-1 text-sm">
                                                    <Skull className="w-3.5 h-3.5" /> {champ.deaths}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {(champ.deaths / (champ.fights || 1)).toFixed(2)} / fight
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Top Attackers */}
                <Card className="bg-slate-950/50 border-slate-800/60">
                    <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                        <CardTitle className="text-lg font-mono text-slate-200 flex items-center gap-2">
                            <Swords className="w-5 h-5 text-emerald-400" />
                            Top Attackers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-800/40">
                                {topAttackers.map((champ, i) => {
                                    const soloRate = champ.fights > 0 ? ((champ.fights - champ.deaths) / champ.fights) * 100 : 0;
                                    const classColors = getChampionClassColors(champ.class);
                                    return (
                                    <tr key={champ.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3 w-8 text-slate-500 font-mono text-xs">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className={cn("h-8 w-8 border-none ring-1.5", classColors.border)}>
                                                    <AvatarImage src={getChampionImageUrl(champ.images, '64')} />
                                                    <AvatarFallback>{champ.name.substring(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className={cn("font-bold truncate", classColors.text)}>
                                                        {champ.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono">{champ.count} uses</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                "font-mono font-bold text-sm",
                                                soloRate >= 95 ? "text-emerald-400" : "text-amber-500"
                                            )}>
                                                {soloRate.toFixed(0)}% Solo
                                            </span>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Hardest Nodes */}
                <Card className="bg-slate-950/50 border-slate-800/60">
                    <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                        <CardTitle className="text-lg font-mono text-slate-200 flex items-center gap-2">
                            <Target className="w-5 h-5 text-amber-500" />
                            Hardest Nodes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-800/40">
                                {hardestNodes.map((node, i) => (
                                    <tr key={node.nodeNumber} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3 w-8 text-slate-500 font-mono text-xs">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className="bg-slate-900 text-amber-500 border-amber-500/30 font-mono text-sm">
                                                Node {node.nodeNumber}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-red-400 font-bold font-mono flex items-center gap-1 text-sm">
                                                    <Skull className="w-3.5 h-3.5" /> {node.deaths}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {node.fights} fights
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
  }