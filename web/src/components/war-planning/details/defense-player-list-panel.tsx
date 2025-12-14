import React, { useMemo } from "react";
import { Users, ChevronLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, PlacementWithNode } from "@cerebro/core/data/war-planning/types";
import { WarMapType, ChampionClass } from "@prisma/client";
import { getChampionImageUrl } from "@/lib/championHelper";
import { motion } from "framer-motion";
import { usePlayerColor } from "../player-color-context";
import { getChampionClassColors } from "@/lib/championClassHelper";

interface DefensePlayerListPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  players: PlayerWithRoster[];
  allPlacements: PlacementWithNode[]; // All placements for the plan
  highlightedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  isDesktop: boolean;
  currentBattlegroup: number;
  mapType: WarMapType;
  selectedNodeId?: number | null;
  onMoveDefender?: (placementId: string, targetNodeId: number) => void;
}

export const DefensePlayerListPanel = ({
  isOpen,
  onToggle,
  players,
  allPlacements,
  highlightedPlayerId,
  onSelectPlayer,
  isDesktop,
  currentBattlegroup,
  mapType,
  selectedNodeId,
  onMoveDefender
}: DefensePlayerListPanelProps) => {
  const { getPlayerColor } = usePlayerColor();
  const championLimit = mapType === "BIG_THING" ? 1 : 5;

  // Calculate player usage stats (filtered by BG)
  const playerStats = useMemo(() => {
    const stats = new Map<string, {
      champions: { id: number; name: string; images: any; class: ChampionClass; nodeId: number; placementId: string; starLevel: number | undefined }[],
      placementCount: number
    }>();

    // Only consider placements for the current battlegroup
    const bgPlacements = allPlacements.filter(p => p.battlegroup === currentBattlegroup);

    bgPlacements.forEach(p => {
        if (p.player && p.defender) {
            const pid = p.player.id;
            if (!stats.has(pid)) {
                stats.set(pid, { champions: [], placementCount: 0 });
            }
            const stat = stats.get(pid)!;
            // A player can place the same champ twice? Usually not in defense, but technically possible.
            // But usually placementCount refers to placed nodes.
            stat.champions.push({
                id: p.defender.id,
                name: p.defender.name,
                images: p.defender.images,
                class: p.defender.class,
                nodeId: p.node.nodeNumber,
                placementId: p.id,
                starLevel: p.starLevel
            });
            stat.placementCount++;
        }
    });

    return stats;
  }, [allPlacements, currentBattlegroup]);

  const sortedPlayers = useMemo(() => {
      return [...players]
        .filter(p => p.battlegroup === currentBattlegroup)
        .sort((a, b) => {
            return a.ingameName.localeCompare(b.ingameName);
        });
  }, [players, currentBattlegroup]);

  if (!isDesktop) return null;

  return (
    <motion.div
      initial={{ width: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}
      animate={{ width: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "flex flex-col border-r border-slate-800 bg-slate-950 h-full overflow-hidden relative shrink-0",
        !isOpen && "w-0 border-none"
      )}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 bg-slate-950">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
                <Users className="w-4 h-4" />
                <span>Defenders (BG{currentBattlegroup})</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
            </Button>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 bg-slate-950">
            <div className="p-2 space-y-1">
                {sortedPlayers.map(player => {
                    const stat = playerStats.get(player.id);
                    const count = stat?.placementCount || 0;
                    const isSelected = highlightedPlayerId === player.id;
                    const isFull = count >= championLimit;
                    const playerColor = getPlayerColor(player.id);

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
                                    ? `linear-gradient(to right, ${playerColor}26, transparent)`
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
                                    "text-xs font-bold px-1.5 py-0.5 rounded",
                                    count > championLimit ? "bg-red-900/50 text-red-400" :
                                    isFull ? "bg-green-900/50 text-green-400" : 
                                    count > 0 ? "bg-blue-900/50 text-blue-400" : "bg-slate-800 text-slate-500"
                                )}>
                                    {count}/{championLimit}
                                </div>
                            </div>

                            {/* Champions Row (Condensed) */}
                            {count > 0 && !isSelected && (
                                <div className="flex gap-1 pl-11 flex-wrap">
                                    {stat?.champions.map((champ, idx) => (
                                        <div key={`${champ.id}-${idx}`} className="relative group/champ">
                                            <img 
                                                src={getChampionImageUrl(champ.images, '64')} 
                                                alt={champ.name}
                                                className={cn(
                                                    "w-7 h-7 rounded-full border-2",
                                                    getChampionClassColors(champ.class).border
                                                )}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Expanded Details */}
                            {isSelected && count > 0 && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="pl-10 pr-1 space-y-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {stat?.champions.sort((a,b) => a.nodeId - b.nodeId).map((champ, idx) => {
                                        const roster = player.roster.find(r => r.championId === champ.id && r.stars === champ.starLevel); // Match by starLevel
                                        const classColors = getChampionClassColors(champ.class);
                                        const isMoveMode = !!selectedNodeId && onMoveDefender && champ.nodeId !== selectedNodeId;

                                        return (
                                            <div 
                                                key={`${champ.id}-${idx}`} 
                                                className={cn(
                                                    "relative group/row flex items-center gap-2 p-1.5 rounded bg-slate-950/50 border border-slate-800 transition-all",
                                                    isMoveMode && "cursor-pointer hover:bg-indigo-950/30 hover:border-indigo-500/50"
                                                )}
                                                onClick={(e) => {
                                                    if (isMoveMode) {
                                                        e.stopPropagation();
                                                        onMoveDefender(champ.placementId, selectedNodeId!);
                                                    }
                                                }}
                                            >
                                                <div className="w-5 flex justify-center text-[10px] font-mono text-slate-500 group-hover/row:text-slate-300">
                                                    #{champ.nodeId}
                                                </div>
                                                <img 
                                                    src={getChampionImageUrl(champ.images, '64')} 
                                                    alt={champ.name}
                                                    className={cn("w-8 h-8 rounded-full border-2", classColors.border)} 
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className={cn("text-xs font-bold truncate transition-colors", classColors.text, isMoveMode && "group-hover/row:text-indigo-300")}>{champ.name}</div>
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
                                                
                                                {isMoveMode && (
                                                    <div className="absolute right-2 opacity-0 group-hover/row:opacity-100 transition-opacity bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                                        Move
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
};
