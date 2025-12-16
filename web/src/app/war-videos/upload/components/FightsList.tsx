import React from "react";
import { Button } from "@/components/ui/button";
import { FightBlock, FightData } from "@/components/FightBlock";
import { Swords, Plus } from "lucide-react";
import { Champion } from "@/types/champion";
import { WarNode as PrismaWarNode } from '@prisma/client';

interface FightsListProps {
  fights: FightData[];
  onFightChange: (fight: FightData) => void;
  onRemoveFight: (id: string) => void;
  onAddFight: () => void;
  initialChampions: Champion[];
  initialNodes: PrismaWarNode[];
  prefightChampions: Champion[];
  uploadMode: "single" | "multiple";
  sourceMode: "upload" | "link";
  errors: Record<string, string>;
}

export function FightsList({
  fights,
  onFightChange,
  onRemoveFight,
  onAddFight,
  initialChampions,
  initialNodes,
  prefightChampions,
  uploadMode,
  sourceMode,
  errors,
}: FightsListProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Swords className="h-5 w-5 text-sky-400" />
        Fight Details
      </h3>
      {fights.map((fight) => (
        <FightBlock
          key={fight.id}
          fight={fight}
          onFightChange={onFightChange}
          onRemove={onRemoveFight}
          canRemove={fights.length > 1}
          initialChampions={initialChampions}
          initialNodes={initialNodes}
          prefightChampions={prefightChampions}
          uploadMode={uploadMode}
          sourceMode={sourceMode}
          errors={errors}
        />
      ))}
      <Button type="button" variant="outline" onClick={onAddFight} className="w-full bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/50 hover:border-sky-500/50 transition-colors">
        <Plus className="mr-2 h-4 w-4" />
        Add Another Fight
      </Button>
    </div>
  );
}
