"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Skull, Swords, Trophy, Users, BarChart3, TrendingUp, ChevronDown, ChevronRight, Activity, Video, Shield } from "lucide-react";
import { useState, useMemo } from "react";
import Link from "next/link";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionClass } from "@prisma/client";

interface WarFightDetail {
  defenderName: string;
  defenderClass: ChampionClass;
  defenderImageUrl: string;
  attackerName: string;
  attackerClass: ChampionClass;
  attackerImageUrl: string;
  nodeNumber: number;
  isSolo: boolean;
  deaths: number;
  videoId: string | null;
  isAttackerTactic: boolean;
  isDefenderTactic: boolean;
}

interface PlayerWarStat {
  warId: string;
  warNumber: number;
  opponent: string;
  fights: number;
  deaths: number;
  fightDetails: WarFightDetail[];
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  avatar: string | null;
  fights: number;
  deaths: number;
  pathFights: number;
  pathDeaths: number;
  miniBossFights: number;
  miniBossDeaths: number;
  bossFights: number;
  bossDeaths: number;
  battlegroup: number;
  warStats: PlayerWarStat[];
}

interface SeasonOverviewViewProps {
  allPlayers: PlayerStats[];
  bgColors: { 1: string; 2: string; 3: string };
}

export function SeasonOverviewView({
  allPlayers,
  bgColors,
}: SeasonOverviewViewProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [selectedBg, setSelectedBg] = useState<1 | 2 | 3 | null>(null);
  const [expandedWars, setExpandedWars] = useState<Record<string, boolean>>({});

  const toggleWar = (warId: string) => {
    const isCurrentlyExpanded = expandedWars[warId] ?? true;
    setExpandedWars(prev => ({
      ...prev,
      [warId]: !isCurrentlyExpanded
    }));
  };

  const bgStats = useMemo(() => {
    const stats = {
      1: { fights: 0, deaths: 0, players: 0, pathDeaths: 0, miniBossDeaths: 0, bossDeaths: 0 },
      2: { fights: 0, deaths: 0, players: 0, pathDeaths: 0, miniBossDeaths: 0, bossDeaths: 0 },
      3: { fights: 0, deaths: 0, players: 0, pathDeaths: 0, miniBossDeaths: 0, bossDeaths: 0 },
    };
    allPlayers.forEach(p => {
      if (p.battlegroup >= 1 && p.battlegroup <= 3) {
        const bg = p.battlegroup as 1|2|3;
        stats[bg].fights += p.fights;
        stats[bg].deaths += p.deaths;
        stats[bg].players += 1;
        stats[bg].pathDeaths += p.pathDeaths;
        stats[bg].miniBossDeaths += p.miniBossDeaths;
        stats[bg].bossDeaths += p.bossDeaths;
      }
    });
    return stats;
  }, [allPlayers]);

  const sortedPlayers = [...allPlayers].sort((a, b) => {
      // Primary: Deaths (Ascending)
      if (a.deaths !== b.deaths) return a.deaths - b.deaths;
      // Secondary: Fights (Descending)
      return b.fights - a.fights;
  });

  const visiblePlayers = useMemo(() => {
    if (!selectedBg) return sortedPlayers;
    return sortedPlayers.filter(p => p.battlegroup === selectedBg);
  }, [sortedPlayers, selectedBg]);

  const getRank = (
    player: PlayerStats,
    index: number,
    players: PlayerStats[]
  ) => {
    if (index === 0) return 1;
    const prev = players[index - 1];
    if (player.deaths === prev.deaths && player.fights === prev.fights) {
      let i = index - 1;
      while (
        i >= 0 &&
        players[i].deaths === player.deaths &&
        players[i].fights === player.fights
      ) {
        i--;
      }
      return i + 2;
    }
    return index + 1;
  };

  const StatCell = ({ fights, deaths }: { fights: number; deaths: number }) => {
    if (fights === 0) return <span className="text-slate-700 font-mono text-sm">-</span>;
    
    return (
      <div className="flex items-center justify-center gap-1.5">
          <span className={cn(
              "font-mono font-black text-sm",
              deaths === 0 ? "text-emerald-500/80" : "text-slate-400"
          )}>{fights}</span>
          {deaths > 0 && (
              <Badge variant="secondary" className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-1.5 h-4 leading-none font-black font-mono flex items-center gap-0.5">
                  <Skull className="w-2.5 h-2.5" /> {deaths}
              </Badge>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-950/40 border-slate-800/60 flex flex-col shadow-2xl backdrop-blur-md overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/60 border-b border-slate-800/60 bg-slate-900/20">
            {[1, 2, 3].map((bgNum) => {
                const bg = bgNum as 1|2|3;
                const stat = bgStats[bg];
                const accent = bgColors[bg];
                const soloRate = stat.fights > 0 ? ((stat.fights - stat.deaths) / stat.fights) * 100 : 0;
                const isSelected = selectedBg === bg;
                const isDimmed = selectedBg !== null && !isSelected;
                
                return (
                    <div 
                        key={bg}
                        onClick={() => setSelectedBg(prev => prev === bg ? null : bg)}
                        className={cn(
                            "p-4 flex items-center justify-between group/bg transition-all duration-300 relative overflow-hidden cursor-pointer",
                            isSelected ? "bg-slate-900/60 ring-1 ring-inset ring-white/10" : "hover:bg-slate-900/40",
                            isDimmed ? "opacity-40 grayscale-[0.5]" : "opacity-100"
                        )}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full opacity-50 transition-opacity group-hover/bg:opacity-100" style={{ backgroundColor: accent }} />
                        <div className="flex flex-col gap-1">
                            <h3 className="font-black italic uppercase tracking-tighter text-sm flex items-center gap-2 text-slate-400">
                                <Users className="w-4 h-4" style={{ color: accent }} />
                                Battlegroup {bg}
                            </h3>
                            <div className="flex items-baseline gap-2">
                                <span className={cn(
                                    "text-2xl font-black italic font-mono leading-none",
                                    soloRate >= 95 ? "text-emerald-400" : soloRate >= 80 ? "text-slate-200" : "text-amber-500"
                                )}>
                                    {soloRate.toFixed(1)}%
                                </span>
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Efficiency</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                             <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-600 uppercase leading-none mb-0.5">Path</span>
                                    <span className={cn("text-sm font-mono font-black", stat.pathDeaths > 0 ? "text-red-400" : "text-slate-500")}>{stat.pathDeaths}</span>
                                </div>
                                <div className="w-px h-6 bg-slate-800/60" />
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-600 uppercase leading-none mb-0.5">MB</span>
                                    <span className={cn("text-sm font-mono font-black", stat.miniBossDeaths > 0 ? "text-red-400" : "text-slate-500")}>{stat.miniBossDeaths}</span>
                                </div>
                                <div className="w-px h-6 bg-slate-800/60" />
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-600 uppercase leading-none mb-0.5">Boss</span>
                                    <span className={cn("text-sm font-mono font-black", stat.bossDeaths > 0 ? "text-red-400" : "text-slate-500")}>{stat.bossDeaths}</span>
                                </div>
                             </div>
                             <div className="flex items-center gap-2 bg-slate-950/40 rounded px-2 py-1 border border-slate-800/40">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Total Deaths</span>
                                <span className="text-sm font-mono font-black text-red-400 leading-none">{stat.deaths}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
          </div>

          <CardHeader className="pb-4 border-b border-slate-800/60 bg-slate-900/40 relative z-10">
            <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-slate-200">
                    <Users className="w-6 h-6" />
                    Alliance Roster Performance
                </CardTitle>
                <Badge variant="outline" className="bg-slate-950/50 text-slate-400 border-slate-800 text-xs font-black uppercase px-2 py-0.5">
                    {visiblePlayers.length} Members
                </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 relative z-10">
            {/* Mobile View (Cards) */}
            <div className="md:hidden flex flex-col gap-2 p-2">
                {visiblePlayers.map((player) => {
                    const globalIndex = sortedPlayers.findIndex(p => p.playerId === player.playerId);
                    const rank = getRank(player, globalIndex, sortedPlayers);
                    const isTop3 = rank <= 3;
                    const soloRate = player.fights > 0 ? ((player.fights - player.deaths) / player.fights) * 100 : 0;
                    const bgAccent = bgColors[player.battlegroup as 1|2|3] || "#94a3b8";

                    return (
                        <div 
                            key={player.playerId}
                            onClick={() => {
                                setExpandedWars({});
                                setSelectedPlayer(player);
                            }}
                            className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3 flex flex-col gap-3 active:bg-slate-800/60 transition-colors"
                            style={{ borderLeft: `4px solid ${isTop3 ? '#f59e0b' : 'transparent'}` }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 flex justify-center shrink-0">
                                    {isTop3 ? (
                                        <div className="relative inline-flex items-center justify-center">
                                            <Trophy className={cn("w-5 h-5 opacity-20 absolute", rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-300" : "text-amber-600")} />
                                            <span className={cn("relative font-black font-mono text-xs", rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-200" : "text-amber-500")}>{rank}</span>
                                        </div>
                                    ) : (
                                        <span className="font-mono text-slate-600 font-black text-xs">{rank}</span>
                                    )}
                                </div>
                                <Avatar className="h-9 w-9 border-none bg-slate-900">
                                    <AvatarImage src={player.avatar || undefined} />
                                    <AvatarFallback className="text-[11px] font-bold">{player.playerName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black uppercase tracking-tighter text-sm truncate text-slate-300">{player.playerName}</span>
                                        <Badge variant="outline" className="bg-slate-950 border-slate-800 font-black font-mono text-[11px] px-1.5 h-4 leading-none" style={{ color: bgAccent, borderColor: `${bgAccent}40` }}>BG{player.battlegroup}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Progress value={soloRate} className="h-1 flex-1 bg-slate-800" indicatorClassName={soloRate >= 95 ? "bg-emerald-500" : soloRate >= 80 ? "bg-amber-500" : "bg-red-500"} />
                                        <span className={cn("text-xs font-black font-mono", soloRate >= 95 ? "text-emerald-500" : "text-slate-500")}>{soloRate.toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 bg-slate-950/30 rounded p-2 border border-slate-800/30">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">Path</span>
                                    <StatCell fights={player.pathFights} deaths={player.pathDeaths} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">MB</span>
                                    <StatCell fights={player.miniBossFights} deaths={player.miniBossDeaths} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">Boss</span>
                                    <StatCell fights={player.bossFights} deaths={player.bossDeaths} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">Total</span>
                                    <div className="flex items-center gap-1 font-mono font-black text-xs">
                                        <span className="text-slate-400">{player.fights}</span>
                                        <span className="text-slate-600">/</span>
                                        <span className={cn(player.deaths === 0 ? "text-emerald-400" : "text-red-400")}>{player.deaths}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="text-left table-auto w-full">
                <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3 w-64">Player</th>
                    <th className="px-4 py-3 w-48 text-center">Efficiency</th>
                    <th className="px-4 py-3 text-center" title="Path Fights">Path</th>
                    <th className="px-4 py-3 text-center" title="Mini-Boss Fights">MB</th>
                    <th className="px-4 py-3 text-center" title="Boss Fights">Boss</th>
                    <th className="px-4 py-3 text-center w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-sm">
                  {visiblePlayers.map((player) => {
                    const globalIndex = sortedPlayers.findIndex(p => p.playerId === player.playerId);
                    const rank = getRank(player, globalIndex, sortedPlayers);
                    const isTop3 = rank <= 3;
                    const soloRate =
                      player.fights > 0
                        ? Math.max(
                            0,
                            ((player.fights - player.deaths) /
                              player.fights) *
                              100
                          )
                        : 0;
                    
                    const bgAccent = bgColors[player.battlegroup as 1|2|3] || "#94a3b8";

                    return (
                      <tr
                        key={player.playerId}
                        className="group/row hover:bg-slate-800/30 transition-all duration-300 cursor-pointer border-l-4 border-l-transparent"
                        style={{ borderLeftColor: isTop3 ? '#f59e0b' : 'transparent' }}
                        onClick={() => {
                            setExpandedWars({});
                            setSelectedPlayer(player);
                        }}
                      >
                        <td className="px-4 py-3 text-center">
                          {isTop3 ? (
                            <div className="relative inline-flex items-center justify-center">
                                <Trophy className={cn(
                                    "w-6 h-6 opacity-20 absolute",
                                    rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-300" : "text-amber-600"
                                )} />
                                <span className={cn(
                                    "relative font-black font-mono text-xs",
                                    rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-200" : "text-amber-500"
                                )}>
                                    {rank}
                                </span>
                            </div>
                          ) : (
                            <span className="font-mono text-slate-600 font-black text-xs">{rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                                <Avatar className="h-9 w-9 border-none shadow-lg bg-slate-900 ring-1 ring-slate-800 transition-transform duration-500 group-hover/row:scale-110">
                                    <AvatarImage src={player.avatar || undefined} />
                                    <AvatarFallback className="text-[11px] bg-slate-800 text-slate-400 font-black">
                                        {player.playerName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex flex-col min-w-0 pr-4">
                                <span className={cn(
                                    "font-black uppercase tracking-tighter text-sm truncate transition-transform duration-300 group-hover/row:translate-x-1",
                                    isTop3 ? "text-slate-100" : "text-slate-400"
                                )}>
                                    {player.playerName}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="bg-slate-950 border-slate-800 font-black font-mono text-xs px-1.5 h-4 leading-none" style={{ color: bgAccent, borderColor: `${bgAccent}30` }}>
                                        BG{player.battlegroup}
                                    </Badge>
                                </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Progress value={soloRate} className="h-2 flex-1 bg-slate-800" indicatorClassName={soloRate >= 95 ? "bg-emerald-500" : soloRate >= 80 ? "bg-amber-500" : "bg-red-500"} />
                                <span className={cn("text-xs font-mono font-black w-10 text-right", soloRate >= 95 ? "text-emerald-500" : "text-slate-500")}>
                                    {soloRate.toFixed(0)}%
                                </span>
                            </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                            <StatCell fights={player.pathFights} deaths={player.pathDeaths} />
                        </td>
                        <td className="px-4 py-3 text-center">
                            <StatCell fights={player.miniBossFights} deaths={player.miniBossDeaths} />
                        </td>
                        <td className="px-4 py-3 text-center">
                            <StatCell fights={player.bossFights} deaths={player.bossDeaths} />
                        </td>
                        <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-mono font-black text-sm">
                                <span className="text-slate-400">{player.fights}</span>
                                <span className="text-slate-600">/</span>
                                <span className={cn(player.deaths === 0 ? "text-emerald-400" : "text-red-400")}>
                                    {player.deaths}
                                </span>
                            </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visiblePlayers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <BarChart3 className="w-10 h-10 text-slate-800 mx-auto mb-2 opacity-20" />
                        <p className="text-xs text-slate-600 font-black uppercase tracking-[0.2em]">No intelligence data</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
      </Card>

      <Dialog
        open={!!selectedPlayer}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
      >
        <DialogContent className="bg-slate-950/95 border-slate-800 text-slate-200 max-w-2xl max-h-[90vh] flex flex-col backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 gap-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-900/50 via-transparent to-transparent pointer-events-none" />
          
          <DialogHeader className="p-6 pb-4 border-b border-slate-800/60 relative z-10 bg-slate-900/40 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {selectedPlayer && (
                        <>
                        <div className="relative">
                            <Avatar className="h-16 w-16 border-none shadow-2xl ring-2 ring-slate-800 bg-slate-900">
                                <AvatarImage src={selectedPlayer.avatar || undefined} />
                                <AvatarFallback className="text-xl bg-slate-800 text-slate-400 font-black">
                                {selectedPlayer.playerName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 rounded-full p-1 shadow-lg">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter text-white">
                                {selectedPlayer.playerName}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="text-amber-500">Combat History</span>
                                <span className="opacity-30">|</span>
                                <span>BG {selectedPlayer.battlegroup}</span>
                            </DialogDescription>
                        </div>
                        </>
                    )}
                </div>
                
                {selectedPlayer && (
                    <div className="flex items-center gap-4">
                        <div className="text-center bg-slate-950/50 border border-slate-800/60 rounded-lg px-4 py-2 min-w-[100px]">
                            <div className="text-xs font-black text-slate-500 uppercase mb-0.5">Survival</div>
                            <div className="text-lg font-black italic text-emerald-400 font-mono">
                                {(((selectedPlayer.fights - selectedPlayer.deaths) / (selectedPlayer.fights || 1)) * 100).toFixed(0)}%
                            </div>
                        </div>
                        <div className="text-center bg-slate-950/50 border border-slate-800/60 rounded-lg px-4 py-2 min-w-[100px]">
                            <div className="text-xs font-black text-slate-500 uppercase mb-0.5">Fights / Deaths</div>
                            <div className="text-lg font-black italic font-mono">
                                <span className="text-slate-200">{selectedPlayer.fights}</span>
                                <span className="text-slate-600 mx-1">/</span>
                                <span className="text-red-400">{selectedPlayer.deaths}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </DialogHeader>

          <div className="p-6 relative z-10 overflow-y-auto flex-1 custom-scrollbar">
            {selectedPlayer && (
                <div className="space-y-4">
                {selectedPlayer.warStats
                    .sort((a, b) => b.warNumber - a.warNumber)
                    .map((war) => {
                        const isExpanded = expandedWars[war.warId] ?? true;
                        return (
                            <Card
                                key={war.warId}
                                className="bg-slate-950/40 border-slate-800/60 overflow-hidden shadow-lg group/war hover:border-slate-700 transition-colors"
                            >
                                <CardHeader 
                                    className="py-3 px-4 border-b border-slate-800/40 bg-slate-900/40 group-hover/war:bg-slate-900/60 transition-colors cursor-pointer"
                                    onClick={() => toggleWar(war.warId)}
                                >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-amber-500">
                                            {war.warNumber}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Target Alliance</span>
                                            <span className="text-base font-black uppercase italic text-slate-200 tracking-tight">
                                                {war.opponent || "Unknown"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-black text-slate-500 uppercase">Fights</span>
                                            <span className="text-base font-mono font-black italic text-slate-300">
                                                {war.fights}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-black text-slate-500 uppercase">War Result</span>
                                            <div className={cn(
                                                "text-base font-mono font-black italic flex items-center gap-1.5",
                                                war.deaths === 0 ? "text-emerald-400" : "text-red-400"
                                            )}>
                                                {war.deaths > 0 && <Skull className="w-4 h-4" />}
                                                {war.deaths === 0 ? "SOLO" : `${war.deaths} DEATH${war.deaths > 1 ? "S" : ""}`}
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-600" /> : <ChevronRight className="w-5 h-5 text-slate-600" />}
                                    </div>
                                </div>
                                </CardHeader>
                                {isExpanded && (
                                    <CardContent className="p-0 animate-in slide-in-from-top-2 duration-300">
                                        <div className="divide-y divide-slate-800/30">
                                            {war.fightDetails.map((fight, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-2 px-4 hover:bg-slate-800/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-5">
                                                <div className="w-11 h-11 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-base text-slate-500 shrink-0">
                                                    {fight.nodeNumber}
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center bg-slate-900/80 rounded-full pl-1.5 pr-5 py-1.5 border border-slate-800 shadow-inner group/pill">
                                                        <div className="relative shrink-0">
                                                            <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", getChampionClassColors(fight.attackerClass).bg)} />
                                                            <Avatar className={cn("h-10 w-10 border-none bg-slate-950 shadow-md relative", getChampionClassColors(fight.attackerClass).border)}>
                                                                <AvatarImage src={fight.attackerImageUrl} />
                                                                <AvatarFallback className="text-xs font-black">
                                                                    {fight.attackerName.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {fight.isAttackerTactic && (
                                                                <div className="absolute -top-1 -left-1 bg-emerald-950/90 rounded-full border border-emerald-500 flex items-center justify-center w-4 h-4 shadow-lg shadow-black z-10">
                                                                    <Swords className="w-2 h-2 text-emerald-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="mx-3 flex flex-col items-center">
                                                            <span className="text-[10px] font-black text-slate-600 uppercase">VS</span>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <div className="relative shrink-0">
                                                                <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", getChampionClassColors(fight.defenderClass).bg)} />
                                                                <Avatar className={cn("h-10 w-10 border-none bg-slate-950 shadow-md relative", getChampionClassColors(fight.defenderClass).border)}>
                                                                    <AvatarImage src={fight.defenderImageUrl} />
                                                                    <AvatarFallback className="text-xs font-black">
                                                                        {fight.defenderName.substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                {fight.isDefenderTactic && (
                                                                    <div className="absolute -top-1 -left-1 bg-red-950/90 rounded-full border border-red-500 flex items-center justify-center w-4 h-4 shadow-lg shadow-black z-10">
                                                                        <Shield className="w-2 h-2 text-red-400" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={cn(
                                                                "text-sm font-black uppercase italic tracking-tighter pr-2",
                                                                getChampionClassColors(fight.defenderClass).text
                                                            )}>
                                                                {fight.defenderName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center">
                                                        {fight.deaths > 0 ? (
                                                            <div className="flex items-center gap-1.5 text-red-400 text-sm font-black uppercase italic tracking-tighter">
                                                                <Skull className="w-3.5 h-3.5" />
                                                                {fight.deaths} Death{fight.deaths > 1 ? "s" : ""}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-emerald-500 text-sm font-black uppercase italic tracking-tighter">
                                                                <Trophy className="w-3.5 h-3.5" />
                                                                Solo
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {fight.videoId && (
                                                        <Link 
                                                            href={`/war-videos/${fight.videoId}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="p-2 ml-2 bg-sky-600/20 border border-sky-600/50 rounded-full hover:bg-sky-600 text-sky-300 hover:text-white transition-all duration-300 group/video shadow-md shadow-sky-500/10 hover:shadow-sky-500/30"
                                                            title="Watch Fight Video"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Video className="w-4 h-4 group-hover/video:scale-110 transition-transform" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-800/60 bg-slate-950 relative z-50 shrink-0 flex justify-end">
            <DialogClose asChild>
                <button 
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 px-6 py-2 rounded-lg text-sm font-black uppercase tracking-[0.2em] text-slate-400 transition-all hover:text-white"
                >
                    Close Log
                </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
