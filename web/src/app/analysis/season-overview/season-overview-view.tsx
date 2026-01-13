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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Skull, Swords } from "lucide-react";
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

  // Helper to determine rank with tie-breaking logic
  // "If players have the same fights and KD ratio we should rank them the same"
  // KD Ratio here is essentially deaths/fights (or survival rate).
  // If deaths and fights are equal, the ratio is equal.
  const getRank = (
    player: PlayerStats,
    index: number,
    allPlayers: PlayerStats[]
  ) => {
    if (index === 0) return 1;
    const prev = allPlayers[index - 1];
    if (player.deaths === prev.deaths && player.fights === prev.fights) {
      // Find the rank of the previous player (recursive or iterative lookup)
      // Since we iterate in order, we can just look at the rendered rank?
      // But here we are in a pure function.
      // We can iterate backwards to find the first one with same stats.
      let i = index - 1;
      while (
        i >= 0 &&
        allPlayers[i].deaths === player.deaths &&
        allPlayers[i].fights === player.fights
      ) {
        i--;
      }
      // i is now the index of the first player with DIFFERENT stats, or -1.
      // So the rank is i + 2 (since index is 0-based, rank is 1-based, and we want rank of (i+1)).
      // Example:
      // Index 0: 0 deaths (Rank 1)
      // Index 1: 0 deaths (Rank 1) -> i becomes -1. Rank is (-1) + 2 = 1.
      // Index 2: 1 death (Rank 3) -> i becomes 1. Rank is 1 + 2 = 3.
      return i + 2;
    }
    return index + 1;
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              className="bg-slate-950/50 border-slate-800/60 flex flex-col transition-all duration-300 hover:border-slate-700"
              style={{ borderColor: `${accentColor}40` }}
            >
              <CardHeader
                className="pb-3 border-b border-slate-800/60 bg-slate-900/20"
                style={{ borderBottomColor: `${accentColor}30` }}
              >
                <CardTitle
                  className="text-xl font-mono flex items-center justify-between"
                  style={{ color: accentColor }}
                >
                  Battlegroup {bg}
                  <Badge
                    variant="outline"
                    className="bg-slate-900 text-slate-400 border-slate-700"
                  >
                    {sortedBgs[bg].length} Players
                  </Badge>
                </CardTitle>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/40 text-sm text-slate-400">
                  <span>Total Stats:</span>
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        "font-mono font-bold",
                        totalSoloRate >= 95
                          ? "text-emerald-400"
                          : totalSoloRate >= 80
                          ? "text-slate-300"
                          : "text-amber-500"
                      )}
                    >
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

                        const deathColor =
                          player.deaths === 0
                            ? "text-emerald-400"
                            : player.deaths < 3
                            ? "text-slate-300"
                            : "text-red-400";

                        return (
                          <tr
                            key={player.playerId}
                            className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
                            onClick={() => setSelectedPlayer(player)}
                          >
                            <td className="px-2 py-3 text-center font-mono text-slate-500">
                              {isTop3 ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                    rank === 1 &&
                                      "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
                                    rank === 2 &&
                                      "bg-slate-400/20 text-slate-300 border border-slate-400/40",
                                    rank === 3 &&
                                      "bg-amber-700/20 text-amber-600 border border-amber-700/40"
                                  )}
                                >
                                  {rank}
                                </span>
                              ) : (
                                <span>{rank}</span>
                              )}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8 border border-slate-700">
                                  <AvatarImage
                                    src={player.avatar || undefined}
                                  />
                                  <AvatarFallback className="text-[10px] bg-slate-800 text-slate-400">
                                    {player.playerName
                                      .substring(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span
                                  className={cn(
                                    "font-medium truncate max-w-[90px] sm:max-w-[120px]",
                                    isTop3 ? "text-slate-200" : "text-slate-400"
                                  )}
                                >
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
                              <span
                                className={cn(
                                  "font-mono font-bold text-sm",
                                  soloRate >= 95
                                    ? "text-emerald-400"
                                    : soloRate >= 80
                                    ? "text-slate-300"
                                    : "text-amber-500"
                                )}
                              >
                                {soloRate.toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm",
                                  deathColor,
                                  player.deaths > 0 &&
                                    "bg-red-950/20 border border-red-900/30"
                                )}
                              >
                                {player.deaths > 0 && (
                                  <Skull className="w-3.5 h-3.5" />
                                )}
                                {player.deaths}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {sortedBgs[bg].length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-slate-500 italic"
                          >
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

      <Dialog
        open={!!selectedPlayer}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
      >
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedPlayer && (
                <>
                  <Avatar className="h-10 w-10 border border-slate-700">
                    <AvatarImage
                      src={selectedPlayer.avatar || undefined}
                    />
                    <AvatarFallback className="text-sm bg-slate-800 text-slate-400">
                      {selectedPlayer.playerName
                        .substring(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span>{selectedPlayer.playerName}</span>
                    <span className="text-xs text-slate-400 font-normal">
                      Season Analysis
                    </span>
                  </div>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Detailed performance breakdown per war.
            </DialogDescription>
          </DialogHeader>

          {selectedPlayer && (
            <div className="space-y-4">
              {selectedPlayer.warStats
                .sort((a, b) => b.warNumber - a.warNumber)
                .map((war) => (
                  <Card
                    key={war.warId}
                    className="bg-slate-900/40 border-slate-800/60"
                  >
                    <CardHeader className="py-3 px-4 border-b border-slate-800/40 bg-slate-900/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-200">
                            War {war.warNumber}
                          </span>
                          <span className="text-sm text-slate-500 font-medium">
                            vs {war.opponent || "Unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm font-mono">
                          <span className="text-slate-400">
                            {war.fights} Fights
                          </span>
                          <span
                            className={cn(
                              "font-bold flex items-center gap-1",
                              war.deaths === 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            )}
                          >
                            <Skull className="w-3.5 h-3.5" />
                            {war.deaths}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-800/40">
                        {war.fightDetails.map((fight, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-2 px-4 hover:bg-slate-800/20"
                          >
                            <div className="flex items-center gap-4">
                              <Badge
                                variant="outline"
                                className="bg-slate-950 text-amber-500 border-slate-800 text-[10px] w-8 justify-center font-mono"
                              >
                                {fight.nodeNumber}
                              </Badge>

                              <div className="flex items-center gap-2">
                                {/* Attacker */}
                                <Avatar className="h-8 w-8 border border-slate-700 bg-slate-900">
                                  <AvatarImage src={fight.attackerImageUrl} />
                                  <AvatarFallback className="text-[10px]">
                                    {fight.attackerName.substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>

                                <Swords className="w-3 h-3 text-slate-600" />

                                {/* Defender */}
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 border border-slate-700 bg-slate-900">
                                    <AvatarImage src={fight.defenderImageUrl} />
                                    <AvatarFallback className="text-[10px]">
                                      {fight.defenderName.substring(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm text-slate-300 font-medium hidden sm:inline-block">
                                    {fight.defenderName}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {fight.deaths > 0 ? (
                              <div className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase">
                                <Skull className="w-3 h-3" />
                                {fight.deaths} Death{fight.deaths > 1 ? "s" : ""}
                              </div>
                            ) : (
                              <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider">
                                Solo
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
