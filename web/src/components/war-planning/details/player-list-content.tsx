import React, { useMemo } from "react";
import { Users, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, FightWithNode } from "../types";
import { War, WarMapType } from "@prisma/client";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ExtraChampion } from "../hooks/use-war-planning";
import { ChampionCombobox } from "@/components/ChampionCombobox"; // Added this import
import { Champion } from "@/types/champion";
import { motion } from "framer-motion";

interface PlayerListContentProps {
  players: PlayerWithRoster[];
  currentFights: FightWithNode[];
  highlightedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  currentBattlegroup: number;
  extraChampions: ExtraChampion[];
  onAddExtra: (playerId: string, championId: number) => void;
  onRemoveExtra: (extraId: string) => void;
  champions: Champion[];
  onClose?: () => void; 
  war: War; // Add war prop
}

export const PlayerListContent = ({
  players,
  currentFights,
  highlightedPlayerId,
  onSelectPlayer,
  currentBattlegroup,
  extraChampions,
  onAddExtra,
  onRemoveExtra,
  champions,
  onClose,
  war // Destructure war prop
}: PlayerListContentProps) => {
  // Determine champion limit based on map type
  const championLimit = war.mapType === WarMapType.BIG_THING ? 2 : 3;

  // Calculate player usage stats
  const playerStats = useMemo(() => {
    const stats = new Map<string, {
      champions: { id: number; name: string; images: any; isExtra?: boolean; extraId?: string }[],
      uniqueCount: number
    }>();

    // Helper to add champ
    const addChamp = (pid: string, cid: number, cname: string, cimages: any, isExtra = false, extraId?: string) => {
        if (!stats.has(pid)) {
            stats.set(pid, { champions: [], uniqueCount: 0 });
        }
        const stat = stats.get(pid)!;
        if (!stat.champions.some(c => c.id === cid)) {
            stat.champions.push({
                id: cid,
                name: cname,
                images: cimages,
                isExtra,
                extraId
            });
            stat.uniqueCount++;
        }
    };

    currentFights.forEach(fight => {
        // 1. Count Attacker
        if (fight.player && fight.attacker) {
            addChamp(fight.player.id, fight.attacker.id, fight.attacker.name, fight.attacker.images);
        }

        // 2. Count Prefights
        if (fight.prefightChampions) {
            fight.prefightChampions.forEach(pf => {
                if (pf.player) {
                    addChamp(pf.player.id, pf.id, pf.name, pf.images);
                }
            });
        }
    });

    // 3. Count Extras
    extraChampions.forEach(ex => {
        if (ex.battlegroup === currentBattlegroup) {
            addChamp(ex.playerId, ex.championId, ex.champion.name, ex.champion.images, true, ex.id);
        }
    });

    return stats;
  }, [currentFights, extraChampions, currentBattlegroup]);

  // Filter players based on battlegroup
  const sortedPlayers = useMemo(() => {
      return [...players]
        .filter(p => p.battlegroup === currentBattlegroup)
        .sort((a, b) => {
            const statsA = playerStats.get(a.id);
            const statsB = playerStats.get(b.id);
            const countA = statsA?.uniqueCount || 0;
            const countB = statsB?.uniqueCount || 0;
            
            // Sort by count descending, then name
            if (countA !== countB) return countB - countA;
            return a.ingameName.localeCompare(b.ingameName);
        });
  }, [players, playerStats, currentBattlegroup]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 bg-slate-950">
        <div className="flex items-center gap-2 text-slate-200 font-medium">
            <Users className="w-4 h-4" />
            <span>Player Overview</span>
        </div>
        {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
            </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 bg-slate-950">
          <div className="p-2 space-y-1">
              {sortedPlayers.map(player => {
                  const stat = playerStats.get(player.id);
                  const count = stat?.uniqueCount || 0;
                  const isSelected = highlightedPlayerId === player.id;
                  const isFull = count >= championLimit;
                  const playerExtras = extraChampions.filter(e => e.playerId === player.id && e.battlegroup === currentBattlegroup);

                  return (
                      <div
                          key={player.id}
                          onClick={() => onSelectPlayer(isSelected ? null : player.id)}
                          className={cn(
                              "group flex flex-col p-2 rounded-md cursor-pointer transition-colors border border-transparent",
                              isSelected 
                                ? "bg-slate-800/80 border-indigo-500/50" 
                                : "hover:bg-slate-900 border-slate-800/50"
                          )}
                      >
                          {/* Player Row */}
                          <div className="flex items-center gap-3 mb-2">
                              <Avatar className="h-8 w-8 border border-slate-700">
                                  <AvatarImage src={player.avatar || undefined} />
                                  <AvatarFallback className="bg-slate-800 text-xs">
                                      {player.ingameName.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0">
                                  <div className={cn("text-sm font-medium truncate", isSelected ? "text-indigo-400" : "text-slate-200")}>
                                      {player.ingameName}
                                  </div>
                              </div>

                              <div className={cn(
                                  "text-xs font-bold px-1.5 py-0.5 rounded",
                                  count > championLimit ? "bg-red-900/50 text-red-400" :
                                  isFull ? "bg-green-900/50 text-green-400" : 
                                  count > 0 ? "bg-blue-900/50 text-blue-400" : "bg-slate-800 text-slate-500"
                              )}>
                                  {count}/{championLimit}
                              </div>
                          </div>

                          {/* Champions Row */}
                          {count > 0 && (
                              <div className="flex gap-1 pl-11 flex-wrap">
                                  {stat?.champions.map(champ => (
                                      <div key={champ.id} className="relative group/champ">
                                          <img 
                                              src={getChampionImageUrl(champ.images, '64')} 
                                              alt={champ.name}
                                              className={cn(
                                                  "w-6 h-6 rounded-full border",
                                                  champ.isExtra ? "border-pink-500 ring-1 ring-pink-500/30" : "border-slate-600"
                                              )}
                                              title={champ.isExtra ? "Extra Assignment" : "Assigned to Fight/Prefight"}
                                          />
                                      </div>
                                  ))}
                              </div>
                          )}

                          {/* Extra Assignments Control (Only when expanded) */}
                          {isSelected && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="pl-11 pr-1 mt-2 space-y-2"
                                onClick={(e) => e.stopPropagation()} // Prevent collapsing
                              >
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Extra Assignments</div>
                                  
                                  {/* List of extras with remove button */}
                                  <div className="space-y-1">
                                      {playerExtras.map(ex => (
                                          <div key={ex.id} className="flex items-center justify-between bg-slate-950/50 p-1.5 rounded border border-slate-800">
                                              <div className="flex items-center gap-2">
                                                  <img 
                                                      src={getChampionImageUrl(ex.champion.images, '64')} 
                                                      alt={ex.champion.name}
                                                      className="w-5 h-5 rounded-full border border-pink-500/50" 
                                                  />
                                                  <span className="text-xs text-slate-300 truncate max-w-[120px]">{ex.champion.name}</span>
                                              </div>
                                              <Button 
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className="h-5 w-5 text-slate-500 hover:text-red-400 hover:bg-red-950/20" 
                                                  onClick={() => onRemoveExtra(ex.id)}
                                              >
                                                  <X className="h-3 w-3" />
                                              </Button>
                                          </div>
                                      ))}
                                  </div>

                                  {/* Add Button */}
                                  <div className="pt-1">
                                      <ChampionCombobox
                                          champions={champions}
                                          value=""
                                          onSelect={(id: string) => onAddExtra(player.id, parseInt(id))}
                                          placeholder="Add extra champion..."
                                          className="h-7 text-xs bg-slate-900/50 border-slate-800 hover:bg-slate-900"
                                      />
                                  </div>
                              </motion.div>
                          )}
                      </div>
                  );
              })}
          </div>
      </ScrollArea>
    </div>
  );
};
