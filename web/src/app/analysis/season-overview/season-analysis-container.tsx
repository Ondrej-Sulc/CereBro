"use client";

import { useState, useRef } from "react";
import { SeasonInsights } from "./season-insights";
import { SeasonDeepDive, DetailedPlacementStat, DeepDiveSelection } from "./season-deep-dive";
import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";
import { BarChart2 } from "lucide-react";

interface ChampionStat {
    id: number;
    name: string;
    class: ChampionClass;
    images: ChampionImages;
    count: number;
    deaths: number;
    fights: number;
}

interface NodeStat {
    nodeNumber: number;
    deaths: number;
    fights: number;
}

interface SeasonAnalysisContainerProps {
    topDefenders: ChampionStat[];
    topAttackers: ChampionStat[];
    hardestNodes: NodeStat[];
    placementStats: DetailedPlacementStat[];
}

export function SeasonAnalysisContainer({ 
    topDefenders, 
    topAttackers, 
    hardestNodes, 
    placementStats 
}: SeasonAnalysisContainerProps) {
    const [selection, setSelection] = useState<DeepDiveSelection | null>(null);
    const deepDiveRef = useRef<HTMLDivElement>(null);

    const handleSelect = (newSelection: DeepDiveSelection) => {
        setSelection({ ...newSelection }); // Clone to ensure useEffect triggers if same selection
        
        // Scroll to deep dive section
        setTimeout(() => {
            deepDiveRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    return (
        <div className="space-y-12">
            {/* Season Insights */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <BarChart2 className="w-6 h-6 text-sky-400" />
                    Season Insights
                </h2>
                <SeasonInsights 
                    topDefenders={topDefenders}
                    topAttackers={topAttackers}
                    hardestNodes={hardestNodes}
                    onSelect={handleSelect}
                />
            </div>

            {/* Deep Dive Analysis */}
            <div ref={deepDiveRef} className="pt-8 border-t border-slate-800/40">
                <SeasonDeepDive 
                    placementStats={placementStats}
                    externalSelection={selection}
                />
            </div>
        </div>
    );
}
