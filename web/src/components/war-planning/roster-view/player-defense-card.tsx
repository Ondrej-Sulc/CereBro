"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, X, Shield } from "lucide-react";
import { PlacementWithNode, PlayerWithRoster } from "@cerebro/core/data/war-planning/types";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { Tag } from "@prisma/client";
import { usePlayerColor } from "../player-color-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NodeBadgePopoverProps {
    placement: PlacementWithNode;
    onMove: (placementId: string, targetNodeNumber: number) => void;
    onEdit: (nodeNumber: number) => void;
}

const NodeBadgePopover = ({ placement, onMove, onEdit }: NodeBadgePopoverProps) => {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button 
                    className="h-8 w-8 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-400 cursor-pointer hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                    onClick={(e) => e.stopPropagation()}
                    title="Click to Move/Swap"
                >
                    {placement.node.nodeNumber}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2" onClick={(e) => e.stopPropagation()}>
                <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-2">
                        <Label htmlFor={`node-${placement.id}`} className="text-xs">Node</Label>
                        <Input
                            id={`node-${placement.id}`}
                            defaultValue={placement.node.nodeNumber}
                            className="col-span-2 h-7 text-xs"
                            type="number"
                            min={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = parseInt(e.currentTarget.value);
                                    if (!isNaN(val)) {
                                        onMove(placement.id, val);
                                        setOpen(false);
                                    }
                                }
                            }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span>Enter to save</span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                onEdit(placement.node.nodeNumber);
                            }}
                            title="Open Editor"
                        >
                            <Shield className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

interface PlayerDefenseCardProps {
  player: PlayerWithRoster;
  placements: PlacementWithNode[];
  onRemove: (placementId: string) => void;
  onEdit: (nodeNumber: number) => void;
  onAdd: (playerId: string) => void;
  limit: number;
  isSelected: boolean;
  onSelect: (playerId: string) => void;
  activeTag?: Tag | null;
  onMove?: (placementId: string, targetNodeNumber: number) => void;
}

export const PlayerDefenseCard = ({
  player,
  placements,
  onRemove,
  onEdit,
  onAdd,
  limit,
  isSelected,
  onSelect,
  activeTag,
  onMove
}: PlayerDefenseCardProps) => {
  const { getPlayerColor } = usePlayerColor();
  const playerColor = getPlayerColor(player.id);

  const sortedPlacements = useMemo(() => {
    const filledSlots = placements.filter((p) => p.defender != null);
    return filledSlots.slice().sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);
  }, [placements]);

  return (
    <Card 
        role="button"
        tabIndex={0}
        className={cn(
            "relative transition-all",
            "bg-slate-900", // Default background
            !isSelected && "border border-slate-800 hover:border-slate-700", // Standard border when not selected
            isSelected && "bg-slate-900/80" // Slightly lighter bg when selected
        )}
        style={{
            // Selected: Full card gradient
            backgroundImage: isSelected 
                ? `linear-gradient(to right, ${playerColor}1A, transparent)`
                : "none",
            // Selected: Custom Faded Border Effect
            // Strong left border, fading top/bottom, transparent right
            borderLeft: isSelected ? `2px solid ${playerColor}` : undefined,
            borderTop: isSelected ? `1px solid ${playerColor}40` : undefined, // 25% opacity
            borderBottom: isSelected ? `1px solid ${playerColor}40` : undefined,
            borderRight: isSelected ? `1px solid transparent` : undefined,
        }}
        onClick={() => onSelect(player.id)}
        onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
                if (e.currentTarget === e.target) {
                    if (e.key === " ") e.preventDefault();
                    onSelect(player.id);
                }
            }
        }}
    >
      <CardHeader 
        className={cn(
            "p-3 pb-2 border-b border-slate-800 flex flex-row items-center justify-between space-y-0"
        )}
        style={{ 
            // Unselected: Header-only gradient
            background: !isSelected 
                ? `linear-gradient(to right, ${playerColor}1A, transparent)` 
                : "transparent"
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
            <Avatar className="h-8 w-8 border" style={{ borderColor: playerColor }}>
                <AvatarImage src={player.avatar || undefined} />
                <AvatarFallback>{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="truncate">
                <div className="font-bold text-sm text-slate-200 truncate">{player.ingameName}</div>
                <div className="text-xs text-slate-500">{sortedPlacements.length}/{limit} Defenders</div>
            </div>
        </div>
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-slate-500 hover:text-white"
            onClick={(e) => {
                e.stopPropagation();
                onAdd(player.id);
            }}
        >
            <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-2 space-y-2">
         {sortedPlacements.length === 0 ? (
            <Button 
                variant="outline"
                className="h-20 flex flex-col items-center justify-center text-slate-600 hover:text-slate-400 text-xs border border-dashed border-slate-800 rounded cursor-pointer hover:bg-slate-800/50 w-full"
                onClick={(e) => {
                    e.stopPropagation();
                    onAdd(player.id);
                }}
            >
                <Shield className="h-6 w-6 mb-1 opacity-50" />
                <span>Add Defender</span>
            </Button>
         ) : (
             <div className="space-y-1.5">
                {sortedPlacements.map(placement => {
                    const champ = placement.defender!;
                    const colors = getChampionClassColors(champ.class);
                    const hasTactic = Boolean(activeTag && champ.tags.some((t) => t.name === activeTag.name));
                    
                    // Find Roster Entry
                    const rosterEntry = player.roster.find(r => 
                        r.championId === champ.id && 
                        (!placement.starLevel || r.stars === placement.starLevel)
                    );

                    return (
                        <div 
                            key={placement.id} 
                            className={cn(
                                "group flex items-center gap-2 p-1.5 rounded border transition-colors",
                                hasTactic ? "bg-teal-950/20 border-teal-500/40" : "bg-slate-950 border-slate-800 hover:border-slate-700"
                            )}
                        >
                            {/* Node Badge (Interactive) */}
                            {onMove ? (
                                <NodeBadgePopover 
                                    placement={placement}
                                    onMove={onMove}
                                    onEdit={onEdit}
                                />
                            ) : (
                                <div 
                                    className="h-8 w-8 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-400 cursor-pointer hover:bg-slate-800 hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(placement.node.nodeNumber);
                                    }}
                                    title="Edit Node"
                                >
                                    {placement.node.nodeNumber}
                                </div>
                            )}

                            {/* Champion Info */}
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                <img 
                                    src={getChampionImageUrl(champ.images, '64')} 
                                    alt={champ.name}
                                    className={cn("h-8 w-8 rounded-full border", colors.border)}
                                />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                        <div className={cn("text-xs font-bold truncate", colors.text)}>
                                            {champ.name}
                                        </div>
                                        {hasTactic && <Shield className="h-3 w-3 text-teal-400 flex-shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                        {placement.starLevel && (
                                            <span className="flex items-center text-yellow-500">
                                                {placement.starLevel}<Star className="h-2 w-2 fill-current ml-0.5" />
                                            </span>
                                        )}
                                        {rosterEntry && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-slate-400">R{rosterEntry.rank}</span>
                                                {rosterEntry.isAscended && <span className="text-pink-400 font-bold text-[9px]">ASC</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-500 hover:text-red-400"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove(placement.id);
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
             </div>
         )}
      </CardContent>
    </Card>
  );
};