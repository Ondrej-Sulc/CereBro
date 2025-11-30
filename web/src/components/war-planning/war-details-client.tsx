"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import WarMap from "@/components/war-planning/war-map";
import NodeEditor from "@/components/war-planning/node-editor";
import PlanningTools from "@/components/war-planning/planning-tools";
import PlanningToolsPanel from "@/components/war-planning/planning-tools-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { WarFight, Player, WarNode, War, WarStatus, WarNodeAllocation, NodeModifier, WarTactic, ChampionClass } from "@prisma/client";
import { Champion } from "@/types/champion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelRightClose, PanelRightOpen, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { warNodesData } from './nodes-data';
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { getActiveTactic } from "@/app/planning/actions";

interface WarDetailsClientProps {
  war: War;
  warId: string;
  updateWarFight: (updatedFight: Partial<WarFight>) => Promise<void>;
  updateWarStatus: (warId: string, status: WarStatus) => Promise<void>;
  champions: Champion[];
  players: PlayerWithRoster[];
}

export type PlayerWithRoster = Player & {
  roster: {
    championId: number;
    stars: number;
    rank: number;
    isAscended: boolean;
    isAwakened: boolean;
  }[];
};

// Re-defining FightWithNode here for clarity in this component
export interface FightWithNode extends WarFight {
  node: WarNode & {
      allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
  };
  attacker: { name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  defender: { name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  player: { ingameName: string } | null;
  prefightChampions?: { id: number; name: string; images: any }[];
}

type RightPanelState = 'closed' | 'tools' | 'editor';

export default function WarDetailsClient({
  war,
  warId,
  updateWarFight,
  updateWarStatus,
  champions,
  players,
}: WarDetailsClientProps) {
  const router = useRouter();
  const [rightPanelState, setRightPanelState] = useState<RightPanelState>('closed');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedFight, setSelectedFight] = useState<FightWithNode | null>(null);
  const [activeTab, setActiveTab] = useState("bg1");
  const [isDesktop, setIsDesktop] = useState(true);
  const [currentFights, setCurrentFights] = useState<FightWithNode[]>([]);
  const [status, setStatus] = useState<WarStatus>(war.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [loadingFights, setLoadingFights] = useState(false);
  const [fightsError, setFightsError] = useState<string | null>(null);
  const [activeTactic, setActiveTactic] = useState<WarTactic | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Persistent History Filters
  const [historyFilters, setHistoryFilters] = useState({
      onlyCurrentTier: true,
      onlyAlliance: true, // Default to own alliance
      minSeason: undefined as number | undefined,
  });

  // Cache history to avoid re-fetching when switching back/forth
  const historyCache = useRef(new Map<string, HistoricalFightStat[]>());

  const currentBattlegroup = parseInt(activeTab.replace("bg", ""));

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Fetch active tactic
  useEffect(() => {
      async function fetchTactic() {
          if (!war.season || !war.warTier) return;
          const tactic = await getActiveTactic(war.season, war.warTier);
          setActiveTactic(tactic);
      }
      fetchTactic();
  }, [war.season, war.warTier]);

  // Fetch fights when battlegroup or war changes
  useEffect(() => {
    async function fetchFights() {
      setLoadingFights(true);
      setFightsError(null);
      try {
        const response = await fetch(`/api/war-planning/fights?warId=${warId}&battlegroup=${currentBattlegroup}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fetchedFights: FightWithNode[] = await response.json();
        setCurrentFights(fetchedFights);
      } catch (err) {
        console.error("Failed to fetch fights:", err);
        setFightsError("Failed to load war data.");
      } finally {
        setLoadingFights(false);
      }
    }
    fetchFights();
  }, [warId, currentBattlegroup]);

  const handleToggleStatus = async () => {
    try {
      setIsUpdatingStatus(true);
      const newStatus = status === 'PLANNING' ? 'FINISHED' : 'PLANNING';
      await updateWarStatus(warId, newStatus);
      setStatus(newStatus);
      router.refresh();
    } catch (error) {
      console.error("Failed to update war status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleNodeClick = useCallback((nodeId: number, fight?: FightWithNode) => {
    setSelectedNodeId(nodeId);
    setSelectedFight(fight || null);
    setRightPanelState('editor');
  }, []);

  const handleNavigateNode = useCallback((direction: number) => {
    if (!selectedNodeId) return;
    
    const currentIndex = warNodesData.findIndex(n => {
       const nid = typeof n.id === 'string' ? parseInt(n.id) : n.id;
       return nid === selectedNodeId;
    });

    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    let attempts = 0;
    const maxAttempts = warNodesData.length;

    do {
        newIndex += direction;
        if (newIndex < 0) newIndex = warNodesData.length - 1;
        if (newIndex >= warNodesData.length) newIndex = 0;
        attempts++;
    } while (warNodesData[newIndex].isPortal && attempts < maxAttempts);

    const newNode = warNodesData[newIndex];
    const newNodeId = typeof newNode.id === 'string' ? parseInt(newNode.id) : newNode.id;
    
    const newFight = currentFights.find(f => f.node.nodeNumber === newNodeId);
    
    handleNodeClick(newNodeId, newFight);
  }, [selectedNodeId, currentFights, handleNodeClick]);

  const handleEditorClose = useCallback(() => {
    setRightPanelState('closed');
    setSelectedNodeId(null);
    setSelectedFight(null);
  }, []);

  const toggleTools = useCallback(() => {
    if (rightPanelState === 'tools') {
      setRightPanelState('closed');
    } else {
      setRightPanelState('tools');
    }
  }, [rightPanelState]);

  const handleSaveFight = useCallback(async (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => {
    // 1. Optimistic Update
    setCurrentFights(prev => prev.map(f => {
      if (f.id === updatedFight.id || (f.warId === updatedFight.warId && f.battlegroup === updatedFight.battlegroup && f.nodeId === updatedFight.nodeId)) {
        const newAttacker = updatedFight.attackerId ? champions.find(c => c.id === updatedFight.attackerId) : (updatedFight.attackerId === null ? null : f.attacker);
        const newDefender = updatedFight.defenderId ? champions.find(c => c.id === updatedFight.defenderId) : (updatedFight.defenderId === null ? null : f.defender);
        const newPlayer = updatedFight.playerId ? players.find(p => p.id === updatedFight.playerId) : (updatedFight.playerId === null ? null : f.player);
        
        let newPrefights = f.prefightChampions;
        if (updatedFight.prefightChampionIds) {
             newPrefights = champions
                .filter(c => updatedFight.prefightChampionIds?.includes(c.id))
                .map(c => ({ id: c.id, name: c.name, images: c.images }));
        }

        const updatedNode = {
            ...f,
            ...updatedFight,
            attacker: newAttacker ? { name: newAttacker.name, images: newAttacker.images } : null,
            defender: newDefender ? { name: newDefender.name, images: newDefender.images } : null,
            player: newPlayer ? { ingameName: newPlayer.ingameName } : null,
            prefightChampions: newPrefights
        } as FightWithNode;

        if (selectedFight && f.node.nodeNumber === selectedFight.node.nodeNumber) {
            setSelectedFight(updatedNode);
        }

        return updatedNode;
      }
      return f;
    }));

    await updateWarFight(updatedFight);
  }, [updateWarFight, champions, players, selectedFight]);

  return (
    <div className={cn(
        "flex w-full overflow-hidden bg-slate-950 transition-all duration-300",
        isFullscreen ? "fixed inset-0 z-[100] h-screen" : "h-[calc(100vh-64px)]"
    )}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className={cn(
            "flex-1 flex flex-col",
            !isFullscreen && "p-4 sm:px-6 border-b border-slate-800"
        )}>
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
                onClick={handleToggleStatus} 
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
                <Button variant="outline" onClick={toggleTools} className="gap-2">
                  {rightPanelState === 'tools' ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  Tools
                </Button>
              </div>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
            <TabsList className={cn("grid w-full grid-cols-3 bg-slate-900", isFullscreen && "hidden")}>
              <TabsTrigger value="bg1">Battlegroup 1</TabsTrigger>
              <TabsTrigger value="bg2">Battlegroup 2</TabsTrigger>
              <TabsTrigger value="bg3">Battlegroup 3</TabsTrigger>
            </TabsList>
            
            <div className={cn(
                "relative overflow-hidden flex-1",
                !isFullscreen && "mt-4 h-[calc(100vh-220px)] rounded-md border border-slate-800"
            )}>
              <TabsContent value="bg1" className="h-full m-0">
                {loadingFights && currentFights.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-slate-400">Loading...</span>
                    </div>
                ) : (
                    <WarMap 
                        warId={warId} 
                        battlegroup={1} 
                        onNodeClick={handleNodeClick} 
                        selectedNodeId={selectedNodeId} 
                        currentWar={war}
                        historyFilters={historyFilters}
                        fights={currentFights}
                        activeTactic={activeTactic}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                    />
                )}
              </TabsContent>
              <TabsContent value="bg2" className="h-full m-0">
                {loadingFights && currentFights.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-slate-400">Loading...</span>
                    </div>
                ) : (
                    <WarMap 
                        warId={warId} 
                        battlegroup={2} 
                        onNodeClick={handleNodeClick} 
                        selectedNodeId={selectedNodeId} 
                        currentWar={war}
                        historyFilters={historyFilters}
                        fights={currentFights}
                        activeTactic={activeTactic}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                    />
                )}
              </TabsContent>
              <TabsContent value="bg3" className="h-full m-0">
                {loadingFights && currentFights.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-slate-400">Loading...</span>
                    </div>
                ) : (
                    <WarMap 
                        warId={warId} 
                        battlegroup={3} 
                        onNodeClick={handleNodeClick} 
                        selectedNodeId={selectedNodeId} 
                        currentWar={war}
                        historyFilters={historyFilters}
                        fights={currentFights}
                        activeTactic={activeTactic}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                    />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Desktop Sidebar */}
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
              onClose={() => setRightPanelState('closed')} 
            />
          )}
          {rightPanelState === 'editor' && (
             <NodeEditor
                key={selectedNodeId}
                onClose={handleEditorClose}
                warId={warId}
                battlegroup={selectedFight?.battlegroup || 1}
                nodeId={selectedNodeId}
                currentFight={selectedFight}
                onSave={handleSaveFight}
                champions={champions}
                players={players}
                onNavigate={handleNavigateNode}
                currentWar={war}
                historyFilters={historyFilters}
                onHistoryFiltersChange={setHistoryFilters}
                historyCache={historyCache}
                activeTactic={activeTactic}
            />
          )}
        </div>
      </div>

      {/* Mobile Node Editor (Sheet) */}
      {!isDesktop && (
        <Sheet open={rightPanelState === 'editor'} onOpenChange={(open) => !open && handleEditorClose()}>
          <SheetContent side="bottom" className="h-[80vh] p-0 border-t border-slate-800 bg-slate-950 md:hidden">
              <div className="sr-only">
                  <SheetTitle>Edit Node</SheetTitle>
                  <SheetDescription>Edit fight details</SheetDescription>
              </div>
              <NodeEditor
                  key={selectedNodeId}
                  onClose={handleEditorClose}
                  warId={warId}
                  battlegroup={selectedFight?.battlegroup || 1}
                  nodeId={selectedNodeId}
                  currentFight={selectedFight}
                  onSave={handleSaveFight}
                  champions={champions}
                  players={players}
                  onNavigate={handleNavigateNode}
                  currentWar={war}
                  historyFilters={historyFilters}
                  onHistoryFiltersChange={setHistoryFilters}
                  historyCache={historyCache}
                  activeTactic={activeTactic}
              />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}