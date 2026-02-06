import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BarChart3, Trophy } from "lucide-react";
import { PlayerStats } from "../types";
import { StatCell } from "./stat-cell";

interface PlayerPerformanceListProps {
  players: PlayerStats[];
  allPlayers: PlayerStats[]; // Needed for global ranking
  bgColors: { 1: string; 2: string; 3: string };
  onSelectPlayer: (player: PlayerStats) => void;
}

export function PlayerPerformanceList({ players, allPlayers, bgColors, onSelectPlayer }: PlayerPerformanceListProps) {
  
  // Sort logic is expected to be handled by parent or we assume 'players' is already sorted if filtered.
  // However, rank calculation needs 'allPlayers' which should be sorted globally.
  // Let's assume 'allPlayers' is the source of truth for sorting order.
  
  const sortedGlobalPlayers = [...allPlayers].sort((a, b) => {
      // Primary: Deaths (Ascending)
      if (a.deaths !== b.deaths) return a.deaths - b.deaths;
      // Secondary: Fights (Descending)
      return b.fights - a.fights;
  });

  const getRank = (
    player: PlayerStats,
    index: number,
    sortedList: PlayerStats[]
  ) => {
    // If the passed index is from the filtered list, we need to find the index in the global list
    const globalIndex = sortedList.findIndex(p => p.playerId === player.playerId);
    
    if (globalIndex === 0) return 1;
    const prev = sortedList[globalIndex - 1];
    if (player.deaths === prev.deaths && player.fights === prev.fights) {
      let i = globalIndex - 1;
      while (
        i >= 0 &&
        sortedList[i].deaths === player.deaths &&
        sortedList[i].fights === player.fights
      ) {
        i--;
      }
      return i + 2;
    }
    return globalIndex + 1;
  };

  return (
    <>
        {/* Mobile View (Cards) */}
        <div className="md:hidden flex flex-col gap-2 p-2">
            {players.map((player, idx) => {
                const rank = getRank(player, idx, sortedGlobalPlayers);
                const isTop3 = rank <= 3;
                const soloRate = player.fights > 0 ? ((player.fights - player.deaths) / player.fights) * 100 : 0;
                const bgAccent = bgColors[player.battlegroup as 1|2|3] || "#94a3b8";

                return (
                    <div 
                        key={player.playerId}
                        onClick={() => onSelectPlayer(player)}
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
              {players.map((player, idx) => {
                const rank = getRank(player, idx, sortedGlobalPlayers);
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
                    onClick={() => onSelectPlayer(player)}
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
              {players.length === 0 && (
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
    </>
  );
}
