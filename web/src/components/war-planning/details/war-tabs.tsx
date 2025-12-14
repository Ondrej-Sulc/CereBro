import React, { memo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import WarMap from "../war-map";
import { WarPlacement } from "@cerebro/core/data/war-planning/types";
import { War, WarTactic, WarMapType } from "@prisma/client";
import { RightPanelState } from "../hooks/use-war-planning";

interface WarTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  isFullscreen: boolean;
  loadingFights: boolean;
  currentFights: WarPlacement[];
  warId?: string; // Optional for Defense
  war?: War; // Optional for Defense
  mapType: WarMapType; // Required
  selectedNodeId: number | null;
  historyFilters: any;
  activeTactic: WarTactic | null;
  onNodeClick: (nodeId: number, fight?: WarPlacement) => void; // Relax type to allow WarPlacement
  onToggleFullscreen: () => void;
  rightPanelState: RightPanelState;
  highlightedPlayerId: string | null;
  onTogglePlayerPanel?: () => void;
  isPlayerPanelOpen?: boolean;
  hideTabsList?: boolean;
}

export const WarTabs = memo(function WarTabs({
  activeTab,
  onTabChange,
  isFullscreen,
  loadingFights,
  currentFights,
  warId,
  war,
  mapType,
  selectedNodeId,
  historyFilters,
  activeTactic,
  onNodeClick,
  onToggleFullscreen,
  rightPanelState,
  highlightedPlayerId,
  onTogglePlayerPanel,
  isPlayerPanelOpen,
  hideTabsList
}: WarTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full flex-1 flex flex-col min-h-0">
      {!hideTabsList && (
      <div className={cn("flex justify-center p-2 bg-slate-900 border-b border-slate-800", isFullscreen && "hidden")}>
        <TabsList className="bg-slate-950 border border-slate-800 p-1 h-auto rounded-lg gap-1">
            <TabsTrigger 
                value="bg1" 
                className="px-6 py-1.5 h-auto text-xs font-bold uppercase tracking-wider rounded-md text-slate-500 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400 data-[state=active]:border-red-500/20 data-[state=active]:ring-1 data-[state=active]:ring-red-500/20 shadow-none border border-transparent"
            >
                BG 1
            </TabsTrigger>
            <TabsTrigger 
                value="bg2" 
                className="px-6 py-1.5 h-auto text-xs font-bold uppercase tracking-wider rounded-md text-slate-500 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/20 data-[state=active]:ring-1 data-[state=active]:ring-blue-500/20 shadow-none border border-transparent"
            >
                BG 2
            </TabsTrigger>
            <TabsTrigger 
                value="bg3" 
                className="px-6 py-1.5 h-auto text-xs font-bold uppercase tracking-wider rounded-md text-slate-500 data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-400 data-[state=active]:border-yellow-500/20 data-[state=active]:ring-1 data-[state=active]:ring-yellow-500/20 shadow-none border border-transparent"
            >
                BG 3
            </TabsTrigger>
        </TabsList>
      </div>
      )}
      
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
                    mapType={mapType}
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
