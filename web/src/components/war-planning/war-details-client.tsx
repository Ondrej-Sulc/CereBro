"use client";

import { useState, useEffect, useCallback } from "react";
import WarMap from "@/components/war-planning/war-map";
import NodeEditor from "@/components/war-planning/node-editor";
import PlanningTools from "@/components/war-planning/planning-tools";
import PlanningToolsPanel from "@/components/war-planning/planning-tools-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { WarFight, Player, WarNode, War } from "@prisma/client";
import { Champion } from "@/types/champion";
import { Button } from "@/components/ui/button";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { warNodesData } from './nodes-data';

interface WarDetailsClientProps {
  war: War;
  warId: string;
  updateWarFight: (updatedFight: Partial<WarFight>) => Promise<void>;
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
  node: WarNode;
  attacker: { name: string; images: any } | null;
  defender: { name: string; images: any } | null;
  player: { ingameName: string } | null;
}

type RightPanelState = 'closed' | 'tools' | 'editor';

export default function WarDetailsClient({
  war,
  warId,
  updateWarFight,
  champions,
  players,
}: WarDetailsClientProps) {
  const [rightPanelState, setRightPanelState] = useState<RightPanelState>('closed');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedFight, setSelectedFight] = useState<FightWithNode | null>(null);
  const [activeTab, setActiveTab] = useState("bg1");
  const [isDesktop, setIsDesktop] = useState(true);
  const [refreshMap, setRefreshMap] = useState(0);
  const [currentFights, setCurrentFights] = useState<FightWithNode[]>([]);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const currentBattlegroup = parseInt(activeTab.replace("bg", ""));

  const handleNodeClick = useCallback((nodeId: number, fight?: FightWithNode) => {
    setSelectedNodeId(nodeId);
    setSelectedFight(fight || null);
    setRightPanelState('editor');
  }, []);

  const handleFightsLoaded = useCallback((fights: FightWithNode[]) => {
    setCurrentFights(fights);
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

  const handleSaveFight = useCallback(async (updatedFight: Partial<WarFight>) => {
    await updateWarFight(updatedFight);
    setRefreshMap((prev) => prev + 1);
  }, [updateWarFight]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 sm:px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              {war.enemyAlliance} <span className="text-lg font-normal text-muted-foreground whitespace-nowrap">AW S{war.season} War {war.warNumber} T{war.warTier}</span>
            </h1>
            
            <div className="flex items-center gap-2 shrink-0">
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
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900">
              <TabsTrigger value="bg1">Battlegroup 1</TabsTrigger>
              <TabsTrigger value="bg2">Battlegroup 2</TabsTrigger>
              <TabsTrigger value="bg3">Battlegroup 3</TabsTrigger>
            </TabsList>
            
            <div className="mt-4 h-[calc(100vh-220px)] relative rounded-md overflow-hidden border border-slate-800">
              <TabsContent value="bg1" className="h-full m-0">
                <WarMap warId={warId} battlegroup={1} onNodeClick={handleNodeClick} refreshTrigger={refreshMap} onFightsLoaded={handleFightsLoaded} selectedNodeId={selectedNodeId} />
              </TabsContent>
              <TabsContent value="bg2" className="h-full m-0">
                <WarMap warId={warId} battlegroup={2} onNodeClick={handleNodeClick} refreshTrigger={refreshMap} onFightsLoaded={handleFightsLoaded} selectedNodeId={selectedNodeId} />
              </TabsContent>
              <TabsContent value="bg3" className="h-full m-0">
                <WarMap warId={warId} battlegroup={3} onNodeClick={handleNodeClick} refreshTrigger={refreshMap} onFightsLoaded={handleFightsLoaded} selectedNodeId={selectedNodeId} />
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
              />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}