import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"; // Import SheetTitle and SheetDescription
import { PanelRightOpen } from "lucide-react";
import PlanningToolsPanel from "./planning-tools-panel";
import { Player, Tag } from "@prisma/client";
import { Champion } from "@/types/champion";


interface PlanningToolsProps {
  players: Player[];
  champions: Champion[];
  allianceId: string;
  currentBattlegroup?: number;
  onAddExtra?: (playerId: string, championId: number) => void;
  assignedChampions?: { playerId: string; championId: number }[];
  activeTag?: Tag | null;
  isReadOnly?: boolean;
}

export default function PlanningTools({ 
  players, 
  champions, 
  allianceId, 
  currentBattlegroup, 
  onAddExtra,
  assignedChampions = [],
  activeTag,
  isReadOnly = false
}: PlanningToolsProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PanelRightOpen className="h-4 w-4" />
          Tools
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0 w-full sm:w-[400px] border-l border-slate-800 bg-slate-950">
        <div className="sr-only">
            <SheetTitle>Planning Tools</SheetTitle>
            <SheetDescription>Search rosters and champions</SheetDescription>
        </div>
        <PlanningToolsPanel 
            players={players} 
            champions={champions} 
            allianceId={allianceId} 
            currentBattlegroup={currentBattlegroup} 
            onAddExtra={onAddExtra}
            assignedChampions={assignedChampions}
            activeTag={activeTag}
            isReadOnly={isReadOnly}
        />
      </SheetContent>
    </Sheet>
  );
}
