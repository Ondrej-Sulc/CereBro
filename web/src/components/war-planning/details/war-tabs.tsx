import React, { memo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import WarMap from "../war-map";
import { FightWithNode } from "@cerebro/core/data/war-planning/types";
import { War, WarTactic } from "@prisma/client";
import { RightPanelState } from "../hooks/use-war-planning";

interface WarTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  isFullscreen: boolean;
  loadingFights: boolean;
  currentFights: FightWithNode[];
  warId: string;
  war: War;
  selectedNodeId: number | null;
  historyFilters: any;
  activeTactic: WarTactic | null;
  onNodeClick: (nodeId: number, fight?: FightWithNode) => void;
  onToggleFullscreen: () => void;
  rightPanelState: RightPanelState;
  highlightedPlayerId: string | null;
  onTogglePlayerPanel?: () => void;
  isPlayerPanelOpen?: boolean;
}

export const WarTabs = memo(function WarTabs({
  activeTab,
  onTabChange,
  isFullscreen,
  loadingFights,
  currentFights,
  warId,
  war,
  selectedNodeId,
  historyFilters,
  activeTactic,
  onNodeClick,
  onToggleFullscreen,
  rightPanelState,
  highlightedPlayerId,
  onTogglePlayerPanel,
  isPlayerPanelOpen
}: WarTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full flex-1 flex flex-col min-h-0">
      <TabsList className={cn("grid w-full grid-cols-3 bg-slate-900", isFullscreen && "hidden")}>
        <TabsTrigger value="bg1">Battlegroup 1</TabsTrigger>
        <TabsTrigger value="bg2">Battlegroup 2</TabsTrigger>
        <TabsTrigger value="bg3">Battlegroup 3</TabsTrigger>
      </TabsList>
      
      <div className={cn(
          "relative overflow-hidden flex-1 min-h-0",
          !isFullscreen && "mt-4 rounded-md border border-slate-800",
          rightPanelState === 'editor' && "rounded-b-none" // Remove bottom rounded corners when editor is open
      )}>
        {['bg1', 'bg2', 'bg3'].map((bgValue, index) => (
          <TabsContent key={bgValue} value={bgValue} className="h-full m-0">
            {loadingFights && currentFights.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                    <span className="text-slate-400">Loading...</span>
                </div>
            ) : (
                <WarMap 
                    warId={warId} 
                    battlegroup={index + 1} 
                    onNodeClick={onNodeClick} 
                    selectedNodeId={selectedNodeId} 
                    currentWar={war}
                    historyFilters={historyFilters}
                    fights={currentFights}
                    activeTactic={activeTactic}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={onToggleFullscreen}
                    highlightedPlayerId={highlightedPlayerId}
                    onTogglePlayerPanel={onTogglePlayerPanel}
                    isPlayerPanelOpen={isPlayerPanelOpen}
                />
            )}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
});
