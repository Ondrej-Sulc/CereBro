"use client";

import { useState } from "react";
import WarMap from "@/components/war-planning/war-map";
import NodeEditor from "@/components/war-planning/node-editor";
import PlanningTools from "@/components/war-planning/planning-tools";
import PlanningToolsPanel from "@/components/war-planning/planning-tools-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WarFight, Champion, Player, WarNode, War } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface WarDetailsClientProps {
  war: War;
  warId: string;
  updateWarFight: (updatedFight: Partial<WarFight>) => Promise<void>;
  champions: Champion[];
  players: Player[];
}

// Re-defining FightWithNode here for clarity in this component
export interface FightWithNode extends WarFight {
  node: WarNode;
  attacker: { name: string; images: any } | null;
  defender: { name: string; images: any } | null;
  player: { ingameName: string } | null;
}

export default function WarDetailsClient({
  war,
  warId,
  updateWarFight,
  champions,
  players,
}: WarDetailsClientProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedFight, setSelectedFight] = useState<FightWithNode | null>(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  const handleNodeClick = (nodeId: number, fight?: FightWithNode) => {
    setSelectedNodeId(nodeId);
    setSelectedFight(fight || null);
    setIsEditorOpen(true);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedNodeId(null);
    setSelectedFight(null);
  };

  const handleSaveFight = async (updatedFight: Partial<WarFight>) => {
    await updateWarFight(updatedFight);
    // TODO: Re-fetch fights for the current battlegroup to update the map
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 sm:px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              {war.enemyAlliance} <span className="text-lg font-normal text-muted-foreground whitespace-nowrap">(S{war.season} T{war.warTier})</span>
            </h1>
            
            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile Tools (Sheet) */}
              <div className="md:hidden">
                <PlanningTools players={players} champions={champions} allianceId={war.allianceId} />
              </div>

              {/* Desktop Tools (Sidebar Toggle) */}
              <div className="hidden md:block">
                <Button variant="outline" onClick={() => setIsToolsOpen(!isToolsOpen)} className="gap-2">
                  {isToolsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  Tools
                </Button>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="bg1" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900">
              <TabsTrigger value="bg1">Battlegroup 1</TabsTrigger>
              <TabsTrigger value="bg2">Battlegroup 2</TabsTrigger>
              <TabsTrigger value="bg3">Battlegroup 3</TabsTrigger>
            </TabsList>
            
            <div className="mt-4 h-[calc(100vh-220px)] relative rounded-md overflow-hidden border border-slate-800">
              <TabsContent value="bg1" className="h-full m-0">
                <WarMap warId={warId} battlegroup={1} onNodeClick={handleNodeClick} />
              </TabsContent>
              <TabsContent value="bg2" className="h-full m-0">
                <WarMap warId={warId} battlegroup={2} onNodeClick={handleNodeClick} />
              </TabsContent>
              <TabsContent value="bg3" className="h-full m-0">
                <WarMap warId={warId} battlegroup={3} onNodeClick={handleNodeClick} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div 
        className={cn(
          "hidden md:block border-l border-slate-800 bg-slate-950 transition-all duration-300 ease-in-out overflow-hidden",
          isToolsOpen ? "w-[400px]" : "w-0"
        )}
      >
        <div className="w-[400px] h-full">
          <PlanningToolsPanel 
            players={players} 
            champions={champions} 
            allianceId={war.allianceId} 
            onClose={() => setIsToolsOpen(false)} 
          />
        </div>
      </div>

      <NodeEditor
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        warId={warId}
        battlegroup={selectedFight?.battlegroup || 1}
        nodeId={selectedNodeId}
        currentFight={selectedFight}
        onSave={handleSaveFight}
        champions={champions}
        players={players}
      />
    </div>
  );
}
