"use client";

import { useState, useEffect, useCallback } from "react";
import { WarFight, War, WarStatus } from "@prisma/client";
import { Champion } from "@/types/champion";
import { cn } from "@/lib/utils";
import { PlayerWithRoster } from "./types";
import { useWarPlanning } from "./hooks/use-war-planning";
import { WarHeader } from "./details/war-header";
import { WarTabs } from "./details/war-tabs";
import { DesktopSidebar } from "./details/desktop-sidebar";
import { MobileSheet } from "./details/mobile-sheet";

interface WarDetailsClientProps {
  war: War;
  warId: string;
  updateWarFight: (updatedFight: Partial<WarFight>) => Promise<void>;
  updateWarStatus: (warId: string, status: WarStatus) => Promise<void>;
  champions: Champion[];
  players: PlayerWithRoster[];
}

export default function WarDetailsClient(props: WarDetailsClientProps) {
  const {
    // State
    rightPanelState,
    activeTab,
    setActiveTab,
    isFullscreen,
    setIsFullscreen,
    selectedNodeId,
    selectedFight,
    currentFights,
    status,
    isUpdatingStatus,
    loadingFights,
    activeTactic,
    historyFilters,
    setHistoryFilters,
    historyCache,
    currentBattlegroup,

    // Handlers
    handleToggleStatus,
    handleNodeClick,
    handleNavigateNode,
    handleEditorClose,
    toggleTools,
    handleSaveFight
  } = useWarPlanning(props);

  const [isDesktop, setIsDesktop] = useState(true);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, [setIsFullscreen]);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isFullscreen]);

  return (
    <div className={cn(
        "flex w-full overflow-hidden bg-slate-950 transition-all duration-300",
        isFullscreen ? "fixed inset-0 z-[100] h-screen" : "h-[calc(100dvh-64px)]",
        isDesktop ? "flex-row" : "flex-col" // KEY LAYOUT CHANGE: flex-row for desktop, flex-col for mobile
    )}>
      {/* Main Content Area (WarHeader + WarTabs/WarMap) */}
      <div className={cn(
          "flex-1 flex flex-col min-w-0 min-h-0", // Added min-h-0 to allow shrinking
      )}>
        <div className={cn(
            "flex-1 flex flex-col min-h-0", // Added min-h-0 here too
            !isFullscreen && "p-4 sm:px-6 border-b border-slate-800"
        )}>
          <WarHeader 
            war={props.war}
            status={status}
            isUpdatingStatus={isUpdatingStatus}
            onToggleStatus={handleToggleStatus}
            rightPanelState={rightPanelState}
            onToggleTools={toggleTools}
            players={props.players}
            champions={props.champions}
            currentBattlegroup={currentBattlegroup}
            isFullscreen={isFullscreen}
          />
          
          <WarTabs 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isFullscreen={isFullscreen}
            loadingFights={loadingFights}
            currentFights={currentFights}
            warId={props.warId}
            war={props.war}
            selectedNodeId={selectedNodeId}
            historyFilters={historyFilters}
            activeTactic={activeTactic}
            onNodeClick={handleNodeClick}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>
      </div>

      {/* Conditional Sidebar / MobileSheet rendering */}
      {isDesktop ? (
        <DesktopSidebar 
          rightPanelState={rightPanelState}
          players={props.players}
          champions={props.champions}
          war={props.war}
          warId={props.warId}
          currentBattlegroup={currentBattlegroup}
          selectedNodeId={selectedNodeId}
          selectedFight={selectedFight}
          activeTactic={activeTactic}
          historyFilters={historyFilters}
          onHistoryFiltersChange={setHistoryFilters}
          historyCache={historyCache}
          onClose={handleEditorClose}
          onNavigate={handleNavigateNode}
          onSave={handleSaveFight}
        />
      ) : (
        // MobileSheet now rendered directly within the flex-col layout
        <MobileSheet 
          isDesktop={isDesktop} // This will be false here
          rightPanelState={rightPanelState}
          selectedNodeId={selectedNodeId}
          selectedFight={selectedFight}
          warId={props.warId}
          war={props.war}
          champions={props.champions}
          players={props.players}
          activeTactic={activeTactic}
          historyFilters={historyFilters}
          onHistoryFiltersChange={setHistoryFilters}
          historyCache={historyCache}
          onClose={handleEditorClose}
          onNavigate={handleNavigateNode}
          onSave={handleSaveFight}
        />
      )}
    </div>
  );
}
