import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skull, Trophy, AlertTriangle, Shield, Swords, Target, BarChart2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeasonSelector } from "./season-selector";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ChampionImages } from "@/types/champion";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionClass } from "@prisma/client";
import { getFromCache } from "@/lib/cache";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import logger from "@/lib/logger";
import { SeasonOverviewView, PlayerStats } from "./season-overview-view";

// Force dynamic rendering to ensure up-to-date data
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  // 0. Check Authentication and Alliance
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/analysis/season-overview");
  }

  if (!player.allianceId) {
    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Season Overview
                </h1>
            </div>
            <Card className="bg-slate-950/50 border-slate-800/60 p-12 flex flex-col items-center justify-center text-center gap-4">
                <Lock className="w-12 h-12 text-slate-700" />
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-300">Alliance Membership Required</h2>
                    <p className="text-slate-500 max-w-md">
                        You must be a member of an alliance to view season statistics. 
                        Please join an alliance in Discord using CereBro.
                    </p>
                </div>
            </Card>
        </div>
    );
  }

  const allianceId = player.allianceId;
  logger.info({ userId: player.id, allianceId }, "User accessing Season Overview page");

  // 1. Fetch available seasons (Cached for 1 hour per alliance)
  const seasons = await getFromCache(`distinct-seasons-${allianceId}`, 3600, async () => {
    const distinctSeasons = await prisma.war.findMany({
        where: { allianceId },
        distinct: ['season'],
        select: { season: true },
        orderBy: { season: 'desc' }
    });
    return distinctSeasons.map(s => s.season).filter(s => s !== 0);
  });

  // Early return if no seasons found
  if (!seasons || seasons.length === 0) {
    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Season Overview
                    </h1>
                    <p className="text-sm text-slate-400 font-medium">
                        {player.alliance?.name}
                    </p>
                </div>
            </div>
            <Card className="bg-slate-950/50 border-slate-800/60 p-12 flex flex-col items-center justify-center text-center gap-4">
                <BarChart2 className="w-12 h-12 text-slate-700" />
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-300">No Season Data Found</h2>
                    <p className="text-slate-500 max-w-md">
                        There are no recorded alliance war seasons in the database for your alliance yet. 
                        Complete some wars to see performance analysis here.
                    </p>
                </div>
            </Card>
        </div>
    );
  }

  const latestSeason = seasons[0];

  // Colors
  const bgColors = {
      1: player.alliance?.battlegroup1Color || "#ef4444",
      2: player.alliance?.battlegroup2Color || "#22c55e",
      3: player.alliance?.battlegroup3Color || "#3b82f6"
  };

  // Parse and validate the selected season
  let selectedSeason: number;
  const seasonParam = awaitedSearchParams.season;
  
  if (typeof seasonParam === 'string') {
      const parsed = parseInt(seasonParam, 10);
      selectedSeason = !isNaN(parsed) && Number.isInteger(parsed) ? parsed : latestSeason;
  } else {
      selectedSeason = latestSeason;
  }

  // Ensure selectedSeason is actually in the seasons list or fallback to latest
  if (!seasons.includes(selectedSeason)) {
      selectedSeason = latestSeason;
  }

    // 2. Fetch War Data (Cached for 5 minutes per alliance/season)
    const wars = await getFromCache(`season-wars-${selectedSeason}-${allianceId}`, 300, () => 
        prisma.war.findMany({
            where: { 
                season: selectedSeason,
                allianceId,
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
        })
    );
  
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
  
    const totalWars = wars.length;
    const mapTypes = new Set<string>();
  
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
            battlegroup: bg,
            warStats: []
          };
        }
        bgStats[bg][pid].fights += 1;
        bgStats[bg][pid].deaths += fight.death;
        
        // War Stats Aggregation
        let playerWarStat = bgStats[bg][pid].warStats.find(w => w.warId === war.id);
        if (!playerWarStat) {
            playerWarStat = {
                warId: war.id,
                warNumber: war.warNumber || 0,
                opponent: war.enemyAlliance || 'Unknown',
                fights: 0,
                deaths: 0,
                fightDetails: []
            };
            bgStats[bg][pid].warStats.push(playerWarStat);
        }

        playerWarStat.fights += 1;
        playerWarStat.deaths += fight.death;
        playerWarStat.fightDetails.push({
            defenderName: fight.defender?.name || 'Unknown',
            defenderClass: fight.defender?.class || 'UNKNOWN',
            defenderImageUrl: getChampionImageUrl(fight.defender?.images as ChampionImages, '64'),
            attackerName: fight.attacker?.name || 'Unknown',
            attackerClass: fight.attacker?.class || 'UNKNOWN',
            attackerImageUrl: getChampionImageUrl(fight.attacker?.images as ChampionImages, '64'),
            nodeNumber: fight.node?.nodeNumber || 0,
            isSolo: fight.death === 0,
            deaths: fight.death
        });

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

    // Global Stats Calculation
    const globalFights = bgTotals[1].fights + bgTotals[2].fights + bgTotals[3].fights;
    const globalDeaths = bgTotals[1].deaths + bgTotals[2].deaths + bgTotals[3].deaths;
    const globalSoloRate = globalFights > 0 ? ((globalFights - globalDeaths) / globalFights) * 100 : 0;
    
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
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Season Overview
                    </h1>
                    <p className="text-sm text-slate-400 font-medium">
                        {player.alliance?.name}
                    </p>
                </div>
            </div>
            <SeasonSelector seasons={seasons} currentSeason={selectedSeason} />
          </div>

          {/* Stats Overview Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1">
                 <span className="text-xs text-slate-500 uppercase font-medium">Season</span>
                 <span className="text-xl font-mono font-bold text-slate-200">{selectedSeason}</span>
              </Card>
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1">
                 <span className="text-xs text-slate-500 uppercase font-medium">Wars</span>
                 <span className="text-xl font-mono font-bold text-slate-200">{totalWars}</span>
              </Card>
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1">
                 <span className="text-xs text-slate-500 uppercase font-medium">Global Solo %</span>
                 <span className={cn(
                     "text-xl font-mono font-bold",
                     globalSoloRate >= 95 ? "text-emerald-400" : globalSoloRate >= 80 ? "text-slate-300" : "text-amber-500"
                 )}>
                     {globalSoloRate.toFixed(1)}%
                 </span>
              </Card>
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1">
                 <span className="text-xs text-slate-500 uppercase font-medium">Total Deaths</span>
                 <div className="flex items-center gap-2 text-red-400">
                    <Skull className="w-4 h-4" />
                    <span className="text-xl font-mono font-bold">{globalDeaths}</span>
                 </div>
              </Card>
              <Card className="bg-slate-900/40 border-slate-800/60 p-4 flex flex-col justify-center items-center gap-1 col-span-2 lg:col-span-1">
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
  
        {/* Interactive Battlegroup Grids */}
        <SeasonOverviewView 
            sortedBgs={sortedBgs} 
            bgTotals={bgTotals} 
            bgColors={bgColors} 
        />

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
                            <tbody className="divide-y divide-slate-800/40 text-sm">
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
                                {topDefenders.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">
                                            No defender data recorded.
                                        </td>
                                    </tr>
                                )}
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
                            <tbody className="divide-y divide-slate-800/40 text-sm">
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
                                {topAttackers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">
                                            No attacker data recorded.
                                        </td>
                                    </tr>
                                )}
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
                            <tbody className="divide-y divide-slate-800/40 text-sm">
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
                                {hardestNodes.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">
                                            No node data recorded.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
  }