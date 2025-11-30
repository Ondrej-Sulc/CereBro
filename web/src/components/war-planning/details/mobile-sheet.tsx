import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import NodeEditor from "../node-editor";
import { PlayerWithRoster, FightWithNode } from "../types";
import { Champion } from "@/types/champion";
import { War, WarFight, WarTactic } from "@prisma/client";
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { RightPanelState } from "../hooks/use-war-planning";

interface MobileSheetProps {
  isDesktop: boolean;
  rightPanelState: RightPanelState;
  selectedNodeId: number | null;
  selectedFight: FightWithNode | null;
  warId: string;
  war: War;
  champions: Champion[];
  players: PlayerWithRoster[];
  activeTactic: WarTactic | null;
  historyFilters: any;
  onHistoryFiltersChange: any;
  historyCache: React.MutableRefObject<Map<string, HistoricalFightStat[]>>;
  onClose: () => void;
  onNavigate: (direction: number) => void;
  onSave: (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => void;
}

export function MobileSheet({
  isDesktop,
  rightPanelState,
  selectedNodeId,
  selectedFight,
  warId,
  war,
  champions,
  players,
  activeTactic,
  historyFilters,
  onHistoryFiltersChange,
  historyCache,
  onClose,
  onNavigate,
  onSave,
}: MobileSheetProps) {
  if (isDesktop) return null;

  return (
    <Sheet open={rightPanelState === 'editor'} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] p-0 border-t border-slate-800 bg-slate-950 md:hidden">
          <div className="sr-only">
              <SheetTitle>Edit Node</SheetTitle>
              <SheetDescription>Edit fight details</SheetDescription>
          </div>
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
          />
      </SheetContent>
    </Sheet>
  );
}
