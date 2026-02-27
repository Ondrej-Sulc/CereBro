"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Shield, Swords } from "lucide-react";
import { DeepDiveSidebar } from "./DeepDiveSidebar";
import { DefenseAnalysisView } from "./DefenseAnalysisView";
import { MatchupAnalysisView } from "./MatchupAnalysisView";
import { 
  DetailedPlacementStat, 
  DeepDiveTab, 
  DeepDiveSelection, 
  ChampionEntity 
} from "./deep-dive-types";

interface SeasonDeepDiveProps {
  placementStats: DetailedPlacementStat[];
  externalSelection?: DeepDiveSelection | null;
}

export function SeasonDeepDive({ placementStats, externalSelection }: SeasonDeepDiveProps) {
  const [activeTab, setActiveTab] = useState<DeepDiveTab>("defense");
  const [activeDefenseSubTab, setActiveDefenseSubTab] = useState<"node" | "defender">("node");
  const [activeMatchupSubTab, setActiveMatchupSubTab] = useState<"attacker" | "counter">("attacker");

  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [selectedDefenderId, setSelectedDefenderId] = useState<number | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<number | null>(null);
  const [selectedCounterDefenderId, setSelectedCounterDefenderId] = useState<number | null>(null);

  const [prevExternalSelection, setPrevExternalSelection] = useState<DeepDiveSelection | null>(null);

  // Sync with external selection (Standard React 19 pattern with structural check)
  const isSelectionChanged = externalSelection && (
    !prevExternalSelection || 
    externalSelection.id !== prevExternalSelection.id || 
    externalSelection.tab !== prevExternalSelection.tab || 
    externalSelection.subTab !== prevExternalSelection.subTab
  );

  if (isSelectionChanged) {
    setPrevExternalSelection(externalSelection);
    
    setActiveTab(externalSelection!.tab);
    if (externalSelection!.tab === "defense") {
      if (externalSelection!.subTab === "node") {
        setActiveDefenseSubTab("node");
        setSelectedNode(externalSelection!.id);
      } else if (externalSelection!.subTab === "defender") {
        setActiveDefenseSubTab("defender");
        setSelectedDefenderId(externalSelection!.id);
      }
    } else {
      if (externalSelection!.subTab === "attacker") {
        setActiveMatchupSubTab("attacker");
        setSelectedAttackerId(externalSelection!.id);
      } else if (externalSelection!.subTab === "counter") {
        setActiveMatchupSubTab("counter");
        setSelectedCounterDefenderId(externalSelection!.id);
      }
    }
  }

  // Unique Entities for Sidebar
  const uniqueNodes = useMemo(() => {
    const nodes = new Set<number>();
    placementStats.forEach((s) => nodes.add(s.nodeNumber));
    return Array.from(nodes).sort((a, b) => a - b);
  }, [placementStats]);

  const uniqueDefenders = useMemo(() => {
    const defenders = new Map<number, ChampionEntity>();
    placementStats.forEach((s) => {
      if (!defenders.has(s.defenderId)) {
        defenders.set(s.defenderId, {
          id: s.defenderId,
          name: s.defenderName,
          class: s.defenderClass,
          images: s.defenderImages,
        });
      }
    });
    return Array.from(defenders.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [placementStats]);

  const uniqueAttackers = useMemo(() => {
    const attackers = new Map<number, ChampionEntity>();
    placementStats.forEach((s) => {
      if (s.attackerId && !attackers.has(s.attackerId)) {
        attackers.set(s.attackerId, {
          id: s.attackerId,
          name: s.attackerName!,
          class: s.attackerClass!,
          images: s.attackerImages!,
        });
      }
    });
    return Array.from(attackers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [placementStats]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <Search className="h-6 w-6 text-purple-400" />
            </div>
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Deep Dive Analysis</h2>
                <p className="text-sm text-slate-500 font-medium">Explore granular season performance and matchups</p>
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeepDiveTab)} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 border border-slate-800 p-1 h-11">
            <TabsTrigger value="defense" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all duration-300 rounded-md">
                <Shield className="w-4 h-4 mr-2" />
                Defense
            </TabsTrigger>
            <TabsTrigger value="matchups" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white transition-all duration-300 rounded-md">
                <Swords className="w-4 h-4 mr-2" />
                Matchups
            </TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <DeepDiveSidebar 
            activeTab={activeTab}
            activeDefenseSubTab={activeDefenseSubTab}
            activeMatchupSubTab={activeMatchupSubTab}
            onDefenseSubTabChange={setActiveDefenseSubTab}
            onMatchupSubTabChange={setActiveMatchupSubTab}
            selectedNode={selectedNode}
            selectedDefenderId={selectedDefenderId}
            selectedAttackerId={selectedAttackerId}
            selectedCounterDefenderId={selectedCounterDefenderId}
            onNodeSelect={setSelectedNode}
            onDefenderSelect={setSelectedDefenderId}
            onAttackerSelect={setSelectedAttackerId}
            onCounterDefenderSelect={setSelectedCounterDefenderId}
            uniqueNodes={uniqueNodes}
            uniqueDefenders={uniqueDefenders}
            uniqueAttackers={uniqueAttackers}
          />
        </div>

        <div className="lg:col-span-3">
          {activeTab === "defense" ? (
            <DefenseAnalysisView 
              activeSubTab={activeDefenseSubTab}
              selectedNode={selectedNode}
              selectedDefenderId={selectedDefenderId}
              placementStats={placementStats}
              uniqueDefenders={uniqueDefenders}
            />
          ) : (
            <MatchupAnalysisView 
              activeSubTab={activeMatchupSubTab}
              selectedAttackerId={selectedAttackerId}
              selectedCounterDefenderId={selectedCounterDefenderId}
              placementStats={placementStats}
              uniqueAttackers={uniqueAttackers}
              uniqueDefenders={uniqueDefenders}
            />
          )}
        </div>
      </div>
    </div>
  );
}