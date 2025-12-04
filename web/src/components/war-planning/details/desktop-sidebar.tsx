import { cn } from "@/lib/utils";
import { RightPanelState } from "../hooks/use-war-planning";
import PlanningToolsPanel from "../planning-tools-panel";
import NodeEditor from "../node-editor";
import { PlayerWithRoster, FightWithNode, SeasonBanWithChampion, WarBanWithChampion } from "../types";
import { Champion } from "@/types/champion";
import { War, WarFight, WarTactic } from "@prisma/client";
import { HistoricalFightStat } from "@/app/planning/history-actions";

interface DesktopSidebarProps {
  rightPanelState: RightPanelState;
  players: PlayerWithRoster[];
  champions: Champion[];
  war: War;
  warId: string;
  currentBattlegroup: number;
  selectedNodeId: number | null;
  selectedFight: FightWithNode | null;
  activeTactic: WarTactic | null;
  historyFilters: any;
  onHistoryFiltersChange: any;
  historyCache: React.MutableRefObject<Map<string, HistoricalFightStat[]>>;
  onClose: () => void;
  onNavigate: (direction: number) => void;
  onSave: (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => void;
  seasonBans: SeasonBanWithChampion[];
  warBans: WarBanWithChampion[];
}

export function DesktopSidebar({
  rightPanelState,
  players,
  champions,
  war,
  warId,
  currentBattlegroup,
  selectedNodeId,
  selectedFight,
  activeTactic,
  historyFilters,
  onHistoryFiltersChange,
  historyCache,
  onClose,
  onNavigate,
  onSave,
  seasonBans,
  warBans,
}: DesktopSidebarProps) {
  return (
    <div 
      className={cn(
        "hidden md:block border-l border-slate-800 bg-slate-950 transition-all duration-300 ease-in-out overflow-hidden",
        rightPanelState !== 'closed' ? "w-[400px]" : "w-0"
      )}
    >
      <div className="w-[400px] h-full">
        {rightPanelState === 'tools' && (
          <PlanningToolsPanel 
            players={players} 
            champions={champions} 
            allianceId={war.allianceId} 
            currentBattlegroup={currentBattlegroup}
            onClose={onClose} 
          />
        )}
        {rightPanelState === 'editor' && (
           <NodeEditor
              key={selectedNodeId}
              onClose={onClose}
              warId={warId}
              battlegroup={selectedFight?.battlegroup || 1}
              nodeId={selectedNodeId}
              currentFight={selectedFight}
              onSave={onSave}
              champions={champions}
              players={players}
              onNavigate={onNavigate}
              currentWar={war}
              historyFilters={historyFilters}
              onHistoryFiltersChange={onHistoryFiltersChange}
              historyCache={historyCache}
              activeTactic={activeTactic}
              seasonBans={seasonBans}
              warBans={warBans}
          />
        )}
      </div>
    </div>
  );
}
