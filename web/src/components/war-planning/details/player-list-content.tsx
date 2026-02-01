import Image from "next/image";
import React, { useMemo } from "react";
import { Users, ChevronLeft, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, FightWithNode } from "@cerebro/core/data/war-planning/types";
import { War, WarMapType, ChampionClass } from "@prisma/client";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ExtraChampion } from "../hooks/use-war-planning";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox"; 
import { Champion, ChampionImages } from "@/types/champion";
import { motion } from "framer-motion";
import { usePlayerColor } from "../player-color-context";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getPathInfo } from "@cerebro/core/data/war-planning/path-logic";

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
  isReadOnly?: boolean;
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
  war, // Destructure war prop
  isReadOnly = false
}: PlayerListContentProps) => {
  const { getPlayerColor } = usePlayerColor();
  // Determine champion limit based on map type
  const championLimit = war.mapType === WarMapType.BIG_THING ? 2 : 3;

  // Calculate player usage stats
  const playerStats = useMemo(() => {
    const stats = new Map<string, {
      champions: { id: number; name: string; images: ChampionImages; class: ChampionClass; isExtra?: boolean; extraId?: string }[], // Updated type to include class
      uniqueCount: number;
      assignedNodes: Set<number>;
    }>();

    // Helper to add champ
    const addChamp = (pid: string, cid: number, cname: string, cimages: ChampionImages, champClass: ChampionClass, isExtra = false, extraId?: string) => { // Updated signature
        if (!stats.has(pid)) {
            stats.set(pid, { champions: [], uniqueCount: 0, assignedNodes: new Set() });
        }
        const stat = stats.get(pid)!;
        if (!stat.champions.some(c => c.id === cid)) {
            stat.champions.push({
                id: cid,
                name: cname,
                images: cimages,
                class: champClass, // Include class
                isExtra,
                extraId
            });
            stat.uniqueCount++;
        }
    };

    // Helper to add node assignment
    const addNode = (pid: string, nodeNumber: number) => {
        if (!stats.has(pid)) {
            stats.set(pid, { champions: [], uniqueCount: 0, assignedNodes: new Set() });
        }
        stats.get(pid)!.assignedNodes.add(nodeNumber);
    };

    currentFights.forEach(fight => {
        // 1. Count Attacker
        if (fight.player && fight.attacker) {
            addChamp(fight.player.id, fight.attacker.id, fight.attacker.name, fight.attacker.images, fight.attacker.class);
            if (fight.node) {
                addNode(fight.player.id, fight.node.nodeNumber);
            }
        }

        // 2. Count Prefights
        if (fight.prefightChampions) {
            fight.prefightChampions.forEach(pf => {
                if (pf.player) {
                    // Need to find class for prefight champion
                    const fullChamp = champions.find(c => c.id === pf.id);
                    if (fullChamp) {
                        addChamp(pf.player.id, pf.id, pf.name, pf.images, fullChamp.class);
                    }
                }
            });
        }
    });

    // 3. Count Extras
    extraChampions.forEach(ex => {
        if (ex.battlegroup === currentBattlegroup) {
            // Need to find class for extra champion
            const fullChamp = champions.find(c => c.id === ex.championId);
            if (fullChamp) {
                addChamp(ex.playerId, ex.championId, ex.champion.name, ex.champion.images, fullChamp.class, true, ex.id);
            }
        }
    });

    return stats;
  }, [currentFights, extraChampions, currentBattlegroup, champions]);

  // Filter players based on battlegroup
  const sortedPlayers = useMemo(() => {
      return [...players]
        .filter(p => p.battlegroup === currentBattlegroup)
        .sort((a, b) => {
            return a.ingameName.localeCompare(b.ingameName);
        });
  }, [players, currentBattlegroup]);

  const getAssignmentLabel = (assignedNodes: Set<number> | undefined) => {
      if (!assignedNodes || assignedNodes.size === 0) return "Unassigned";

      if (war.mapType === WarMapType.BIG_THING) {
          const nodes = Array.from(assignedNodes).sort((a, b) => a - b);
          return `Node ${nodes.join(", ")}`;
      }

      // Standard Map Logic
      const s1Paths = new Set<number>();
      const s2Paths = new Set<number>();
      
      assignedNodes.forEach(node => {
          const pathInfo = getPathInfo(node);
          if (pathInfo?.section === 1) s1Paths.add(pathInfo.path);
          if (pathInfo?.section === 2) s2Paths.add(pathInfo.path);
      });

      const s1Str = s1Paths.size > 0 ? `P${Array.from(s1Paths).sort((a,b)=>a-b).join(",")}` : "-";
      const s2Str = s2Paths.size > 0 ? `P${Array.from(s2Paths).sort((a,b)=>a-b).join(",")}` : "-";

      return `${s1Str} / ${s2Str}`;
  };

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
              {sortedPlayers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
                      <Users className="w-10 h-10 text-slate-800" />
                      <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-400">No Players in BG {currentBattlegroup}</p>
                          <p className="text-xs text-slate-600">Assign players to battlegroup roles in Discord to see them here.</p>
                      </div>
                  </div>
              ) : sortedPlayers.map(player => {
                  const stat = playerStats.get(player.id);
                  const count = stat?.uniqueCount || 0;
                  const isSelected = highlightedPlayerId === player.id;
                  const isFull = count >= championLimit;
                  const playerExtras = extraChampions.filter(e => e.playerId === player.id && e.battlegroup === currentBattlegroup);
                  const playerColor = getPlayerColor(player.id);

                  const assignedChampions = stat?.champions.filter(c => !c.isExtra) || [];
                  const assignmentLabel = getAssignmentLabel(stat?.assignedNodes);

                  return (
                      <div
                          key={player.id}
                          onClick={() => onSelectPlayer(isSelected ? null : player.id)}
                          className={cn(
                              "group flex flex-col p-2 rounded-r-md cursor-pointer transition-all border border-slate-800/50 border-l-4",
                              !isSelected && "hover:bg-slate-900"
                          )}
                          style={{
                              borderLeftColor: playerColor,
                              backgroundImage: isSelected 
                                ? `linear-gradient(to right, ${playerColor}26, transparent)` // ~15% opacity fade
                                : 'none'
                          }}
                      >
                          {/* Player Row */}
                          <div className="flex items-center gap-3 mb-1">
                              <div className="relative">
                                <Avatar 
                                    className="h-8 w-8 border-2"
                                    style={{ borderColor: playerColor }}
                                >
                                    <AvatarImage src={player.avatar || undefined} />
                                    <AvatarFallback className="bg-slate-800 text-xs">
                                        {player.ingameName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                  <div className={cn("text-sm font-bold truncate", isSelected ? "text-indigo-400" : "text-slate-200")}>
                                      {player.ingameName}
                                  </div>
                              </div>

                              <div className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap",
                                  count > championLimit ? "bg-red-900/50 text-red-400" :
                                  isFull ? "bg-green-900/50 text-green-400" : 
                                  count > 0 ? "bg-blue-900/50 text-blue-400" : "bg-slate-800 text-slate-500"
                              )}>
                                  {assignmentLabel}
                              </div>
                          </div>

                          {/* Champions Row (Condensed - Only when NOT selected) */}
                          {count > 0 && !isSelected && (
                              <div className="flex gap-1 pl-11 flex-wrap">
                                  {stat?.champions.map(champ => (
                                      <div key={champ.id} className="relative group/champ">
                                          <Image 
                                              src={getChampionImageUrl(champ.images, '64')} 
                                              alt={champ.name}
                                              width={28}
                                              height={28}
                                              className={cn(
                                                  "rounded-full border-2",
                                                  champ.isExtra ? "border-pink-500 ring-1 ring-pink-500/30" : getChampionClassColors(champ.class).border
                                              )}
                                              title={champ.isExtra ? "Extra Assignment" : "Assigned to Fight/Prefight"}
                                          />
                                      </div>
                                  ))}
                              </div>
                          )}

                          {/* Expanded Details (When selected) */}
                          {isSelected && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="pl-10 pr-1 space-y-3"
                                onClick={(e) => e.stopPropagation()} // Prevent collapsing
                              >
                                  {/* Assigned Champions List */}
                                  {assignedChampions.length > 0 && (
                                      <div className="space-y-1">
                                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Assignments</div>
                                          {assignedChampions.map(champ => {
                                              // Find the BEST roster entry (highest stars > rank > ascended)
                                              const roster = player.roster
                                                  .filter(r => r.championId === champ.id)
                                                  .sort((a, b) => {
                                                      if (a.stars !== b.stars) return b.stars - a.stars;
                                                      if (a.rank !== b.rank) return b.rank - a.rank;
                                                      return (a.isAscended === b.isAscended) ? 0 : (a.isAscended ? -1 : 1);
                                                  })[0];

                                              const classColors = getChampionClassColors(champ.class);
                                              return (
                                                  <div key={champ.id} className="flex items-center gap-2 p-1.5 rounded bg-slate-950/50 border border-slate-800">
                                                      <Image 
                                                          src={getChampionImageUrl(champ.images, '64')} 
                                                          alt={champ.name}
                                                          width={32}
                                                          height={32}
                                                          className={cn("rounded-full border-2", classColors.border)} 
                                                      />
                                                      <div className="flex-1 min-w-0">
                                                          <div className={cn("text-xs font-bold truncate", classColors.text)}>{champ.name}</div>
                                                          {roster && (
                                                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                                  <span className={cn("flex items-center", roster.isAwakened ? "text-slate-300" : "text-yellow-500")}>
                                                                      {roster.stars}<Star className="h-2 w-2 fill-current ml-0.5" />
                                                                  </span>
                                                                  <span className="font-mono">R{roster.rank}</span>
                                                                  {roster.isAscended && <span className="text-pink-400 font-bold">ASC</span>}
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  )}

                                  {/* Extra Assignments Control */}
                                  <div className="space-y-1">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Extra Assignments</div>
                                      
                                      {/* List of extras with remove button */}
                                      <div className="space-y-1">
                                          {playerExtras.map(ex => {
                                              // Find the BEST roster entry (highest stars > rank > ascended)
                                              const roster = player.roster
                                                  .filter(r => r.championId === ex.championId)
                                                  .sort((a, b) => {
                                                      if (a.stars !== b.stars) return b.stars - a.stars;
                                                      if (a.rank !== b.rank) return b.rank - a.rank;
                                                      return (a.isAscended === b.isAscended) ? 0 : (a.isAscended ? -1 : 1);
                                                  })[0];

                                              const fullChamp = champions.find(c => c.id === ex.championId); // Look up full champion to get class
                                              const classColors = getChampionClassColors(fullChamp?.class); // Use fullChamp?.class
                                              return (
                                              <div key={ex.id} className="flex items-center justify-between bg-slate-950/50 p-1.5 rounded border border-pink-900/30">
                                                  <div className="flex items-center gap-2 overflow-hidden">
                                                      <Image 
                                                          src={getChampionImageUrl(ex.champion.images, '64')} 
                                                          alt={ex.champion.name}
                                                          width={32}
                                                          height={32}
                                                          className={cn("rounded-full border-2", classColors.border)} 
                                                      />
                                                      <div className="flex-1 min-w-0">
                                                          <div className={cn("text-xs font-bold truncate", classColors.text)}>{ex.champion.name}</div>
                                                          {roster && (
                                                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                                  <span className={cn("flex items-center", roster.isAwakened ? "text-slate-300" : "text-yellow-500")}>
                                                                      {roster.stars}<Star className="h-2 w-2 fill-current ml-0.5" />
                                                                  </span>
                                                                  <span className="font-mono">R{roster.rank}</span>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                                  {!isReadOnly && (
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-950/20 shrink-0" 
                                                        onClick={() => onRemoveExtra(ex.id)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                              </div>
                                          )})}
                                      </div>

                                      {/* Add Button */}
                                      {!isReadOnly && (
                                        <div className="pt-1">
                                            <ChampionCombobox
                                                champions={champions}
                                                value=""
                                                onSelect={(id: string) => onAddExtra(player.id, parseInt(id))}
                                                placeholder="Add extra champion..."
                                                className="h-7 text-xs bg-slate-900/50 border-slate-800 hover:bg-slate-900"
                                            />
                                        </div>
                                      )}
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