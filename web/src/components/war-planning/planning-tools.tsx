import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"; // Import SheetTitle and SheetDescription
import { PanelRightOpen } from "lucide-react";
import PlanningToolsPanel from "./planning-tools-panel";
import { Champion, Player } from "@prisma/client";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"; // Import VisuallyHidden if available, or just hide it with CSS class

interface PlanningToolsProps {
  players: Player[];
  champions: Champion[];
  allianceId: string;
  currentBattlegroup?: number;
}

export default function PlanningTools({ players, champions, allianceId, currentBattlegroup }: PlanningToolsProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PanelRightOpen className="h-4 w-4" />
          Tools
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0 w-full sm:w-[400px] border-l border-slate-800 bg-slate-950">
        <VisuallyHidden>
            <SheetTitle>Planning Tools</SheetTitle>
            <SheetDescription>Search rosters and champions</SheetDescription>
        </VisuallyHidden>
        <PlanningToolsPanel players={players} champions={champions} allianceId={allianceId} currentBattlegroup={currentBattlegroup} />
      </SheetContent>
    </Sheet>
  );
}
