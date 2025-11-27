"use client";

import { Champion, Player } from "@prisma/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import PlanningToolsPanel from "./planning-tools-panel";

interface PlanningToolsProps {
  players: Player[];
  champions: Champion[];
  allianceId: string;
}

export default function PlanningTools({ players, champions, allianceId }: PlanningToolsProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Search className="h-4 w-4" />
          Search Tools
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] p-0 bg-slate-950 border-l border-slate-800">
         {/* Pass onClose undefined as Sheet handles it, or we can pass a handler to close sheet if needed */}
         <PlanningToolsPanel players={players} champions={champions} allianceId={allianceId} />
      </SheetContent>
    </Sheet>
  );
}
