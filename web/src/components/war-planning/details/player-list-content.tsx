import Image from "next/image";
import React, { useMemo } from "react";
import { Users, ChevronLeft, Star, TriangleAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, FightWithNode } from "@cerebro/core/data/war-planning/types";
import { War, WarMapType, ChampionClass } from "@prisma/client";
import { getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
import { ExtraChampion } from "../hooks/use-war-planning";
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
  war: War; 
  isReadOnly?: boolean;
  activeDefensePlan?: { placements: { defenderId: number | null; playerId: string | null }[] } | null;
}

export const PlayerListContent = ({
  players,
  currentFights,
  highlightedPlayerId,
  onSelectPlayer,
  currentBattlegroup,
  extraChampions,
  champions,
  onClose,
  war, 
  activeDefensePlan
}: PlayerListContentProps) => {
  const { getPlayerColor } = usePlayerColor();
  const championLimit = war.mapType === WarMapType.BIG_THING ? 2 : 3;

  const isChampionOnDefense = (championId: number, playerId: string) => {
      return activeDefensePlan?.placements?.some(p => p.defenderId === championId && p.playerId === playerId) ?? false;
  };

  const playerStats = useMemo(() => {
    const stats = new Map<string, {
      champions: { id: number; name: string; images: ChampionImages; class: ChampionClass; isExtra?: boolean; extraId?: string }[],
      uniqueCount: number;
      assignedNodes: Set<number>;
    }>();

    const addChamp = (pid: string, cid: number, cname: string, cimages: ChampionImages, champClass: ChampionClass, isExtra = false, extraId?: string) => {
        if (!stats.has(pid)) {
            stats.set(pid, { champions: [], uniqueCount: 0, assignedNodes: new Set() });
        }
        const stat = stats.get(pid)!;
        if (!stat.champions.some(c => c.id === cid)) {
            stat.champions.push({
                id: cid,
                name: cname,
                images: cimages,
                class: champClass,
                isExtra,
                extraId
            });
            stat.uniqueCount++;
        }
    };

    const addNode = (pid: string, nodeNumber: number) => {
        if (!stats.has(pid)) {
            stats.set(pid, { champions: [], uniqueCount: 0, assignedNodes: new Set() });
        }
        stats.get(pid)!.assignedNodes.add(nodeNumber);
    };

    currentFights.forEach(fight => {
        if (fight.player && fight.attacker) {
            addChamp(fight.player.id, fight.attacker.id, fight.attacker.name, fight.attacker.images, fight.attacker.class);
            if (fight.node) {
                addNode(fight.player.id, fight.node.nodeNumber);
            }
        }

        if (fight.prefightChampions) {
            fight.prefightChampions.forEach(pf => {
                if (pf.player) {
                    const fullChamp = champions.find(c => c.id === pf.id);
                    if (fullChamp) {
                        addChamp(pf.player.id, pf.id, fullChamp.name, fullChamp.images, fullChamp.class);
                    }
                }
            });
        }
    });

    extraChampions.forEach(ex => {
        if (ex.battlegroup === currentBattlegroup) {
            const fullChamp = champions.find(c => c.id === ex.championId);
            if (fullChamp) {
                addChamp(ex.playerId, ex.championId, ex.champion.name, ex.champion.images, fullChamp.class, true, ex.id);
            }
        }
    });

    return stats;
  }, [currentFights, extraChampions, currentBattlegroup, champions]);

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
                  const playerColor = getPlayerColor(player.id);
                  const assignmentLabel = getAssignmentLabel(stat?.assignedNodes);

                  return (
                      <div
                          key={player.id}
                          onClick={() => onSelectPlayer(player.id)}
                          className={cn(
                              "group flex flex-col p-2.5 rounded-r-md cursor-pointer transition-all border border-slate-800/50 border-l-4",
                              "hover:bg-slate-900 hover:border-slate-700/50 hover:shadow-md"
                          )}
                          style={{
                              borderLeftColor: playerColor,
                          }}
                      >
                          <div className="flex items-center gap-3 mb-1">
                              <Avatar 
                                  className="h-8 w-8 border-2 transition-transform group-hover:scale-105"
                                  style={{ borderColor: playerColor }}
                              >
                                  <AvatarImage src={player.avatar || undefined} />
                                  <AvatarFallback className="bg-slate-800 text-xs">
                                      {player.ingameName.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold truncate text-slate-200 group-hover:text-white transition-colors">
                                      {player.ingameName}
                                  </div>
                              </div>

                              <div className="flex items-center gap-2">
                                  <div className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap",
                                      count > championLimit ? "bg-red-900/50 text-red-400" :
                                      isFull ? "bg-green-900/50 text-green-400" : 
                                      count > 0 ? "bg-blue-900/50 text-blue-400" : "bg-slate-800 text-slate-500"
                                  )}>
                                      {assignmentLabel}
                                  </div>
                                  <ExternalLink className="h-4 w-4 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-indigo-400 transition-all -ml-1 group-hover:ml-0" />
                              </div>
                          </div>

                          {count > 0 && (
                              <div className="flex gap-1 pl-11 flex-wrap mt-1">
                                  {stat?.champions.map(champ => (
                                      <div key={champ.id} className="relative group/champ">
                                          <Image 
                                              src={getChampionImageUrlOrPlaceholder(champ.images, '64')} 
                                              alt={champ.name}
                                              width={28}
                                              height={28}
                                              className={cn(
                                                  "rounded-full border-2 bg-slate-900 transition-transform group-hover/champ:scale-110",
                                                  champ.isExtra ? "border-pink-500 ring-1 ring-pink-500/30" : getChampionClassColors(champ.class).border
                                              )}
                                              title={champ.isExtra ? "Extra Assignment" : "Assigned to Fight/Prefight"}
                                          />
                                          {isChampionOnDefense(champ.id, player.id) && (
                                              <div className="absolute -top-1 -right-1 bg-slate-950 rounded-full z-10" title="Placed on Defense">
                                                  <TriangleAlert className="h-3 w-3 text-amber-500 fill-amber-500/10" />
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>
      </ScrollArea>
    </div>
  );
};