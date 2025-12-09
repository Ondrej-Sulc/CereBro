import React from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { PlayerCombobox } from "@/components/comboboxes/PlayerCombobox";
import { Champion } from "@/types/champion";
import { PlayerWithRoster } from "@cerebro/core/data/war-planning/types";
import { getChampionImageUrl } from "@/lib/championHelper";
import Image from "next/image";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils"; // Explicitly added cn import

interface PrefightEntry {
  championId: number;
  playerId: string | null;
}

interface PrefightSelectorProps {
  prefights: PrefightEntry[];
  onChange: (newPrefights: PrefightEntry[]) => void;
  champions: Champion[];
  players: PlayerWithRoster[];
}

export function PrefightSelector({
  prefights,
  onChange,
  champions,
  players
}: PrefightSelectorProps) {
  const [isAdding, setIsAdding] = React.useState(false);

  const handleAdd = (championIdStr: string) => {
    const championId = parseInt(championIdStr, 10);
    if (isNaN(championId)) return;
    if (!prefights.some(p => p.championId === championId)) {
      onChange([...prefights, { championId, playerId: null }]);
    }
    setIsAdding(false);
  };

  const handleRemove = (championId: number) => {
    onChange(prefights.filter(p => p.championId !== championId));
  };

  const handlePlayerChange = (championId: number, playerId: string | undefined) => {
    onChange(prefights.map(p => 
      p.championId === championId 
        ? { ...p, playerId: playerId === undefined ? null : playerId } 
        : p
    ));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* List of existing prefights */}
      <div className="space-y-2">
        {prefights.map((p) => {
          const champ = champions.find(c => c.id === p.championId);
          if (!champ) return null;

          // Filter players who own this champion vs those who don't
          const owners = players.filter(player => 
              player.roster.some(r => r.championId === p.championId)
          ).sort((a, b) => {
              // Sort by rank
              const rosterA = a.roster.find(r => r.championId === p.championId)!;
              const rosterB = b.roster.find(r => r.championId === p.championId)!;
              if (rosterA.stars !== rosterB.stars) return rosterB.stars - rosterA.stars;
              if (rosterA.rank !== rosterB.rank) return rosterB.rank - rosterA.rank;
              return a.ingameName.localeCompare(b.ingameName);
          });

          const others = players.filter(player => 
              !player.roster.some(r => r.championId === p.championId)
          ).sort((a, b) => a.ingameName.localeCompare(b.ingameName));

          const sortedPlayers = [...owners, ...others];

          return (
            <div key={p.championId} className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-md border border-slate-800">
              {/* Champion Image */}
              <div className="relative flex-shrink-0">
                 <Image
                    src={getChampionImageUrl(champ.images as any, '64')}
                    alt={champ.name}
                    width={32}
                    height={32}
                    className={cn("rounded-full border-2", getChampionClassColors(champ.class).border)}
                 />
              </div>
              
              {/* Player Selection */}
              <div className="flex-1 min-w-0">
                 <div className={cn("text-xs font-medium mb-1 truncate", getChampionClassColors(champ.class).text)}>{champ.name}</div>
                 <PlayerCombobox 
                    players={sortedPlayers}
                    value={p.playerId || undefined}
                    onSelect={(val) => handlePlayerChange(p.championId, val)}
                    placeholder="Assign Player..."
                    compact
                    attackerId={p.championId} // Pass champion ID to show rank info
                 />
              </div>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-500 hover:text-red-400"
                onClick={() => handleRemove(p.championId)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Add Button / Combobox */}
      {isAdding ? (
        <div className="flex gap-2 items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex-1">
                <ChampionCombobox
                    champions={champions}
                    value=""
                    onSelect={handleAdd}
                    placeholder="Search champion..."
                    onOpenChange={(open) => !open && setIsAdding(false)}
                />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
                <X className="h-4 w-4" />
            </Button>
        </div>
      ) : (
        <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-dashed border-slate-700 hover:bg-slate-800 text-slate-400"
            onClick={() => setIsAdding(true)}
        >
            <Plus className="h-3 w-3 mr-2" /> Add Prefight
        </Button>
      )}
    </div>
  );
}
