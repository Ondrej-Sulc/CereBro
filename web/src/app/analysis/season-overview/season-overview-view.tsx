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
import { Skull, Swords, Trophy, Users, BarChart3, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface WarFightDetail {
  defenderName: string;
  defenderClass: string;
  defenderImageUrl: string;
  attackerName: string;
  attackerClass: string;
  attackerImageUrl: string;
  nodeNumber: number;
  isSolo: boolean;
  deaths: number;
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
  battlegroup: number;
  warStats: PlayerWarStat[];
}

interface SeasonOverviewViewProps {
  sortedBgs: Record<number, PlayerStats[]>;
  bgTotals: Record<number, { fights: number; deaths: number }>;
  bgColors: { 1: string; 2: string; 3: string };
}

export function SeasonOverviewView({
  sortedBgs,
  bgTotals,
  bgColors,
}: SeasonOverviewViewProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [expandedWars, setExpandedWars] = useState<Record<string, boolean>>({});

  const toggleWar = (warId: string) => {
    // Current state is either false (collapsed), true (expanded), or undefined (meaning default expanded)
    const isCurrentlyExpanded = expandedWars[warId] ?? true;
    setExpandedWars(prev => ({
      ...prev,
      [warId]: !isCurrentlyExpanded
    }));
  };

  const getRank = (
    player: PlayerStats,
    index: number,
    allPlayers: PlayerStats[]
  ) => {
    if (index === 0) return 1;
    const prev = allPlayers[index - 1];
    if (player.deaths === prev.deaths && player.fights === prev.fights) {
      let i = index - 1;
      while (
        i >= 0 &&
        allPlayers[i].deaths === player.deaths &&
        allPlayers[i].fights === player.fights
      ) {
        i--;
      }
      return i + 2;
    }
    return index + 1;
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map((bgNum) => {
          const bg = bgNum as 1 | 2 | 3;
          const totalFights = bgTotals[bg].fights;
          const totalDeaths = bgTotals[bg].deaths;
          const totalSoloRate =
            totalFights > 0
              ? ((totalFights - totalDeaths) / totalFights) * 100
              : 0;

          const accentColor = bgColors[bg];

          return (
            <Card
              key={bg}
              className="bg-slate-950/40 border-slate-800/60 flex flex-col transition-all duration-500 hover:border-slate-700 relative overflow-hidden group/card shadow-2xl backdrop-blur-md"
              style={{ borderTop: `4px solid ${accentColor}` }}
            >
              {/* Ghost BG Number */}
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] select-none pointer-events-none group-hover/card:scale-110 transition-transform duration-1000">
                <span className="text-9xl font-black italic" style={{ color: accentColor }}>{bg}</span>
              </div>

              <CardHeader
                className="pb-4 border-b border-slate-800/60 bg-slate-900/40 relative z-10"
              >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3" style={{ color: accentColor }}>
                        <Users className="w-6 h-6" />
                        BG {bg}
                    </CardTitle>
                    <Badge variant="outline" className="bg-slate-950/50 text-slate-400 border-slate-800 text-[10px] font-black uppercase px-2 py-0.5">
                        {sortedBgs[bg].length} Players
                    </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3 flex flex-col items-center justify-center gap-1 backdrop-blur-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Group Solo %</span>
                        <span className={cn(
                            "text-lg font-mono font-black italic",
                            totalSoloRate >= 90 ? "text-emerald-400" : "text-amber-500"
                        )}>
                            {totalSoloRate.toFixed(0)}%
                        </span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3 flex flex-col items-center justify-center gap-1 backdrop-blur-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Loss</span>
                        <div className="flex items-center gap-2 text-red-400">
                            <Skull className="w-4 h-4" />
                            <span className="text-lg font-mono font-black italic">{totalDeaths}</span>
                        </div>
                    </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 flex-1 relative z-10">
                <div className="overflow-x-auto">
                  <table className="w-full text-left table-fixed">
                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                      <tr>
                        <th className="px-4 py-3 w-10 text-center">#</th>
                        <th className="px-2 py-3">Player</th>
                        <th className="px-2 py-3 w-16 text-center">Fights</th>
                        <th className="px-2 py-3 w-24 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 text-sm">
                      {sortedBgs[bg].map((player, index) => {
                        const rank = getRank(player, index, sortedBgs[bg]);
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

                        return (
                          <tr
                            key={player.playerId}
                            className="group/row hover:bg-slate-800/30 transition-all duration-300 cursor-pointer border-l-2 border-l-transparent"
                            style={{ borderLeftColor: index === 0 ? accentColor : 'transparent' }}
                            onClick={() => {
                                // Reset expanded wars for new player
                                setExpandedWars({});
                                setSelectedPlayer(player);
                            }}
                          >
                            <td className="px-4 py-4 text-center">
                              {isTop3 ? (
                                <div className="relative inline-flex items-center justify-center">
                                    <Trophy className={cn(
                                        "w-6 h-6 opacity-20 absolute",
                                        rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-300" : "text-amber-600"
                                    )} />
                                    <span className={cn(
                                        "relative font-black italic font-mono text-xs",
                                        rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-200" : "text-amber-500"
                                    )}>
                                        {rank}
                                    </span>
                                </div>
                              ) : (
                                <span className="font-mono text-slate-600 font-black italic text-xs">{rank}</span>
                              )}
                            </td>
                            <td className="px-2 py-4">
                              <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                    <Avatar className="h-9 w-9 border-none shadow-lg bg-slate-900 ring-1 ring-slate-800 transition-transform duration-500 group-hover/row:scale-110">
                                        <AvatarImage src={player.avatar || undefined} />
                                        <AvatarFallback className="text-[10px] bg-slate-800 text-slate-400 font-black">
                                            {player.playerName.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="flex flex-col min-w-0 overflow-hidden pr-2">
                                    <span className={cn(
                                        "font-black uppercase italic tracking-tighter text-sm truncate transition-transform duration-300 group-hover/row:translate-x-1",
                                        isTop3 ? "text-slate-100" : "text-slate-400"
                                    )}>
                                        {player.playerName}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Progress value={soloRate} className="h-1 w-12 bg-slate-800" indicatorStyle={{ backgroundColor: soloRate >= 90 ? '#10b981' : '#f59e0b' }} />
                                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">{soloRate.toFixed(0)}% S</span>
                                    </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-4 text-center">
                              <span className="font-mono font-black italic text-base text-slate-200">
                                {player.fights}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                                <div className="flex flex-col items-end">
                                    <span className={cn(
                                        "font-mono font-black italic text-sm leading-none flex items-center gap-1",
                                        player.deaths === 0 ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        {player.deaths > 0 && <Skull className="w-3 h-3" />}
                                        {player.deaths === 0 ? "SOLO" : `${player.deaths} DEATHS`}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter mt-1 opacity-70">
                                        {(player.deaths / (player.fights || 1)).toFixed(2)} AVG
                                    </span>
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                      {sortedBgs[bg].length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center">
                            <BarChart3 className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-20" />
                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">No intelligence data</p>
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
                            <Avatar className="h-14 w-14 border-none shadow-2xl ring-2 ring-slate-800 bg-slate-900">
                                <AvatarImage src={selectedPlayer.avatar || undefined} />
                                <AvatarFallback className="text-xl bg-slate-800 text-slate-400 font-black">
                                {selectedPlayer.playerName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 rounded-full p-1 shadow-lg">
                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter text-white">
                                {selectedPlayer.playerName}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 font-black uppercase tracking-[0.2em] flex items-center gap-2">
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
                        <div className="text-center bg-slate-950/50 border border-slate-800/60 rounded-lg px-3 py-1.5 min-w-[80px]">
                            <div className="text-[9px] font-black text-slate-500 uppercase">Survival</div>
                            <div className="text-sm font-black italic text-emerald-400 font-mono">
                                {(((selectedPlayer.fights - selectedPlayer.deaths) / (selectedPlayer.fights || 1)) * 100).toFixed(0)}%
                            </div>
                        </div>
                        <div className="text-center bg-slate-950/50 border border-slate-800/60 rounded-lg px-3 py-1.5 min-w-[80px]">
                            <div className="text-[9px] font-black text-slate-500 uppercase">Total Loss</div>
                            <div className="text-sm font-black italic text-red-400 font-mono">
                                {selectedPlayer.deaths}
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
                                        <div className="w-8 h-8 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-xs text-amber-500">
                                            {war.warNumber}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Alliance</span>
                                            <span className="text-sm font-black uppercase italic text-slate-200 tracking-tight">
                                                {war.opponent || "Unknown"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-500 uppercase">Mission Result</span>
                                            <div className={cn(
                                                "text-sm font-mono font-black italic flex items-center gap-1.5",
                                                war.deaths === 0 ? "text-emerald-400" : "text-red-400"
                                            )}>
                                                {war.deaths > 0 && <Skull className="w-3 h-3" />}
                                                {war.deaths === 0 ? "SOLO" : `${war.deaths} LOSS`}
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                                    </div>
                                </div>
                                </CardHeader>
                                {isExpanded && (
                                    <CardContent className="p-0 animate-in slide-in-from-top-2 duration-300">
                                        <div className="divide-y divide-slate-800/30">
                                            {war.fightDetails.map((fight, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-3 px-4 hover:bg-slate-800/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-slate-500 shrink-0">
                                                    {fight.nodeNumber}
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center bg-slate-900/80 rounded-full pl-1 pr-4 py-1 border border-slate-800 shadow-inner group/pill">
                                                        <div className="relative shrink-0">
                                                            <Avatar className="h-8 w-8 border-none ring-1 ring-slate-700 bg-slate-950 shadow-md">
                                                                <AvatarImage src={fight.attackerImageUrl} />
                                                                <AvatarFallback className="text-[10px] font-black">
                                                                    {fight.attackerName.substring(0, 2)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500/20 p-0.5 rounded-full ring-1 ring-slate-950">
                                                                <Swords className="w-2 h-2 text-emerald-400" />
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="mx-2 flex flex-col items-center">
                                                            <span className="text-[8px] font-black text-slate-600 uppercase">VS</span>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-8 w-8 border-none ring-1 ring-slate-700 bg-slate-950 shadow-md">
                                                                <AvatarImage src={fight.defenderImageUrl} />
                                                                <AvatarFallback className="text-[10px] font-black">
                                                                    {fight.defenderName.substring(0, 2)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-xs font-black uppercase italic tracking-tighter text-slate-300 pr-2">
                                                                {fight.defenderName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] font-black text-slate-600 uppercase">Engagement</span>
                                                    {fight.deaths > 0 ? (
                                                        <div className="flex items-center gap-1 text-red-400 text-xs font-black uppercase italic tracking-tighter">
                                                            <Skull className="w-3 h-3" />
                                                            {fight.deaths} Loss{fight.deaths > 1 ? "es" : ""}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-black uppercase italic tracking-tighter">
                                                            <Trophy className="w-3 h-3" />
                                                            Solo
                                                        </div>
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
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-[0.2em] text-slate-400 transition-all hover:text-white"
                >
                    Close Log
                </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}