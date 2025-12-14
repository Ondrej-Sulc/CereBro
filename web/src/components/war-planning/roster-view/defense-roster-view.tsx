import React, { useMemo } from "react";
import { PlayerWithRoster, PlacementWithNode } from "@cerebro/core/data/war-planning/types";
import { WarMapType, Tag } from "@prisma/client";
import { PlayerDefenseCard } from "./player-defense-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DefenseRosterViewProps {
  players: PlayerWithRoster[];
  placements: PlacementWithNode[];
  onRemove: (placementId: string) => void;
  onEdit: (nodeId: number) => void;
  onAdd: (playerId: string) => void;
  currentBattlegroup: number;
  mapType: WarMapType;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  activeTag?: Tag | null;
}

export const DefenseRosterView = ({
  players,
  placements,
  onRemove,
  onEdit,
  onAdd,
  currentBattlegroup,
  mapType,
  selectedPlayerId,
  onSelectPlayer,
  activeTag
}: DefenseRosterViewProps) => {
  
  const championLimit = mapType === WarMapType.BIG_THING ? 1 : 5;

  // Filter players for this BG
  const bgPlayers = useMemo(() => {
      return players
        .filter(p => p.battlegroup === currentBattlegroup)
        .sort((a, b) => a.ingameName.localeCompare(b.ingameName));
  }, [players, currentBattlegroup]);

  // Group placements by player
  const placementsByPlayer = useMemo(() => {
      const map = new Map<string, PlacementWithNode[]>();
      placements.filter(p => p.battlegroup === currentBattlegroup).forEach(p => {
          if (p.playerId) {
              if (!map.has(p.playerId)) map.set(p.playerId, []);
              map.get(p.playerId)!.push(p);
          }
      });
      return map;
  }, [placements, currentBattlegroup]);

  return (
    <ScrollArea className="h-full bg-slate-950">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {bgPlayers.map(player => (
                <PlayerDefenseCard 
                    key={player.id}
                    player={player}
                    placements={placementsByPlayer.get(player.id) || []}
                    onRemove={onRemove}
                    onEdit={onEdit}
                    onAdd={onAdd}
                    limit={championLimit}
                    isSelected={selectedPlayerId === player.id}
                    onSelect={onSelectPlayer}
                    activeTag={activeTag}
                />
            ))}
        </div>
    </ScrollArea>
  );
};
