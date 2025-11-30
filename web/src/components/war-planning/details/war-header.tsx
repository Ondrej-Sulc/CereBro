import { War, WarStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, PanelRightClose, PanelRightOpen } from "lucide-react";
import { RightPanelState } from "../hooks/use-war-planning";
import PlanningTools from "../planning-tools";
import { Champion } from "@/types/champion";
import { PlayerWithRoster } from "../types";
import { cn } from "@/lib/utils";

interface WarHeaderProps {
  war: War;
  status: WarStatus;
  isUpdatingStatus: boolean;
  onToggleStatus: () => void;
  rightPanelState: RightPanelState;
  onToggleTools: () => void;
  players: PlayerWithRoster[];
  champions: Champion[];
  currentBattlegroup: number;
  isFullscreen: boolean;
}

export function WarHeader({
  war,
  status,
  isUpdatingStatus,
  onToggleStatus,
  rightPanelState,
  onToggleTools,
  players,
  champions,
  currentBattlegroup,
  isFullscreen,
}: WarHeaderProps) {
  return (
    <div className={cn(
       "flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4",
       isFullscreen && "hidden"
    )}>
      <div className="flex items-center gap-3 overflow-hidden">
         <h1 className="text-2xl sm:text-3xl font-bold truncate">
            {war.enemyAlliance} <span className="text-lg font-normal text-muted-foreground whitespace-nowrap">AW S{war.season} War {war.warNumber} T{war.warTier}</span>
         </h1>
         {status === 'FINISHED' && (
             <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10">Finished</Badge>
         )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Button 
          variant={status === 'PLANNING' ? "destructive" : "outline"} 
          size="sm"
          onClick={onToggleStatus} 
          disabled={isUpdatingStatus}
          className="gap-2"
        >
          {status === 'PLANNING' ? (
              <>
                  <Lock className="h-4 w-4" /> Finish War
              </>
          ) : (
              <>
                  <Unlock className="h-4 w-4" /> Reopen War
              </>
          )}
        </Button>

        {/* Mobile Tools (Sheet) */}
        <div className="md:hidden">
          <PlanningTools 
            players={players} 
            champions={champions} 
            allianceId={war.allianceId}
            currentBattlegroup={currentBattlegroup}
          />
        </div>

        {/* Desktop Tools (Sidebar Toggle) */}
        <div className="hidden md:block">
          <Button variant="outline" onClick={onToggleTools} className="gap-2">
            {rightPanelState === 'tools' ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            Tools
          </Button>
        </div>
      </div>
    </div>
  );
}
