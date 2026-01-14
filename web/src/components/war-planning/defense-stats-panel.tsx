"use client";

import { useMemo } from "react";
import { PlacementWithNode } from "@cerebro/core/data/war-planning/types";
import { Tag } from "@prisma/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DefenseStatsPanelProps {
  onClose: () => void;
  placements: PlacementWithNode[];
  activeTag: Tag | null;
  currentBattlegroup: number;
}

const CLASS_COLORS: Record<string, string> = {
  science: "#10b981", // green-500
  skill: "#ef4444",   // red-500
  mutant: "#eab308",  // yellow-500
  tech: "#3b82f6",    // blue-500
  cosmic: "#14b8a6",  // teal-500
  mystic: "#a855f7",  // purple-500
};

export default function DefenseStatsPanel({
  onClose,
  placements,
  activeTag,
  currentBattlegroup,
}: DefenseStatsPanelProps) {
  
  const stats = useMemo(() => {
    const filled = placements.filter(p => p.defenderId);
    const uniqueDefenders = new Set(filled.map(p => p.defenderId));
    
    // Diversity
    const diversityCount = uniqueDefenders.size;
    const totalFilled = filled.length;
    const diversityPercent = totalFilled > 0 ? (diversityCount / totalFilled) * 100 : 100;

    // Tactic Count
    let tacticCount = 0;
    const classCounts: Record<string, number> = {};

    filled.forEach(p => {
        if (!p.defender) return;
        
        // Class
        const c = p.defender.class.toLowerCase();
        classCounts[c] = (classCounts[c] || 0) + 1;

        // Tactic (Check against activeTag)
        if (activeTag && p.defender.tags) {
             if (p.defender.tags.some(t => t.name === activeTag.name)) {
                 tacticCount++;
             }
        }
    });

    const chartData = Object.entries(classCounts).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);

    return {
        diversityCount,
        totalFilled,
        diversityPercent,
        tacticCount,
        chartData
    };
  }, [placements, activeTag]);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-lg">BG {currentBattlegroup} Stats</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Diversity Section */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">Diversity</span>
                <span className={cn(
                    "text-sm font-bold",
                    stats.diversityPercent === 100 ? "text-green-400" : "text-yellow-400"
                )}>
                    {stats.diversityCount}/{stats.totalFilled}
                </span>
            </div>
            <Progress value={stats.diversityPercent} className="h-2 bg-slate-800" />
            <p className="text-[10px] text-slate-500 mt-2">
                Unique defenders placed in this battlegroup.
            </p>
        </div>

        {/* Tactic Section */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-300">Tactic Defenders</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                        {activeTag ? activeTag.name : "No tag selected"}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-indigo-400">
                        {stats.tacticCount}
                    </span>
                    <ShieldCheck className="h-5 w-5 text-slate-600" />
                </div>
            </div>
        </div>

        {/* Class Breakdown (Pie Chart) */}
        {stats.totalFilled > 0 && (
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 flex flex-col items-center">
                <span className="text-sm font-medium text-slate-300 w-full text-left mb-4">Class Breakdown</span>
                <div className="w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stats.chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CLASS_COLORS[entry.name] || "#64748b"} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                                itemStyle={{ color: '#e2e8f0' }}
                                formatter={(value: number | string | (number | string)[] | undefined, name: string | number | undefined) => {
                                    if (value === undefined || name === undefined) return null;
                                    const numValue = typeof value === 'number' ? value : 0;
                                    const strName = String(name);
                                    return [`${numValue} (${((numValue / stats.totalFilled) * 100).toFixed(0)}%)`, strName.charAt(0).toUpperCase() + strName.slice(1)];
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                
                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 w-full">
                    {stats.chartData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[entry.name] || "#64748b" }} />
                            <span className="text-xs text-slate-400 capitalize flex-1">{entry.name}</span>
                            <span className="text-xs font-bold text-slate-200">{entry.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
