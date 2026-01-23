"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Shield, Swords, Target, Skull, ChevronDown, ChevronUp } from "lucide-react";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";
import { DeepDiveSelection } from "./season-deep-dive";
import { Button } from "@/components/ui/button";

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

interface SeasonInsightsProps {
    topDefenders: ChampionStat[];
    topAttackers: ChampionStat[];
    hardestNodes: NodeStat[];
    onSelect: (selection: DeepDiveSelection) => void;
}

export function SeasonInsights({ topDefenders, topAttackers, hardestNodes, onSelect }: SeasonInsightsProps) {
    const [showAllDefenders, setShowAllDefenders] = useState(false);
    const [showAllAttackers, setShowAllAttackers] = useState(false);
    const [showAllNodes, setShowAllNodes] = useState(false);

    const displayedDefenders = showAllDefenders ? topDefenders : topDefenders.slice(0, 5);
    const displayedAttackers = showAllAttackers ? topAttackers : topAttackers.slice(0, 5);
    const displayedNodes = showAllNodes ? hardestNodes : hardestNodes.slice(0, 5);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Deadly Defenders */}
            <Card className="bg-slate-950/50 border-slate-800/60 flex flex-col h-full">
                <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                    <CardTitle className="text-lg font-mono text-slate-200 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-red-400" />
                        Deadliest Defenders
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <div 
                        className={cn(
                            "transition-all duration-300",
                            showAllDefenders ? "max-h-[400px] overflow-y-auto" : "max-h-none"
                        )}
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <table className="w-full text-sm table-fixed">
                        <tbody className="divide-y divide-slate-800/40 text-sm">
                            {displayedDefenders.map((champ, i) => {
                                const classColors = getChampionClassColors(champ.class);
                                return (
                                <tr 
                                    key={champ.id} 
                                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                    onClick={() => onSelect({ tab: "defense", subTab: "defender", id: champ.id })}
                                >
                                    <td className="px-4 py-3 w-8 text-slate-500 font-mono text-xs">{i + 1}</td>
                                    <td className="px-4 py-3 max-w-0">
                                        <div className="flex items-center gap-3">
                                            <Avatar 
                                                className={cn("h-8 w-8 border-none shrink-0 transition-transform group-hover:scale-110", classColors.bg)}
                                                style={{ boxShadow: `0 0 0 1.5px ${classColors.color}` }}
                                            >
                                                <AvatarImage src={getChampionImageUrl(champ.images, '64')} />
                                                <AvatarFallback>{champ.name.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <span className={cn("font-bold truncate", classColors.text)}>
                                                {champ.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 w-24 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-red-400 font-bold font-mono flex items-center gap-1 text-sm">
                                                <Skull className="w-3.5 h-3.5" /> {champ.deaths}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {(champ.deaths / (champ.fights || 1)).toFixed(2)} / fight
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {topDefenders.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">
                                        No defender data recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </CardContent>
                {topDefenders.length > 5 && (
                    <div className="p-2 border-t border-slate-800/40 bg-slate-900/10">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs text-slate-500 hover:text-slate-300"
                            onClick={() => setShowAllDefenders(!showAllDefenders)}
                        >
                            {showAllDefenders ? (
                                <><ChevronUp className="w-3 h-3 mr-1" /> Show Less</>
                            ) : (
                                <><ChevronDown className="w-3 h-3 mr-1" /> Show More ({topDefenders.length - 5})</>
                            )}
                        </Button>
                    </div>
                )}
            </Card>

            {/* Top Attackers */}
            <Card className="bg-slate-950/50 border-slate-800/60 flex flex-col h-full">
                <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                    <CardTitle className="text-lg font-mono text-slate-200 flex items-center gap-2">
                        <Swords className="w-5 h-5 text-emerald-400" />
                        Top Attackers
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <div 
                        className={cn(
                            "transition-all duration-300",
                            showAllAttackers ? "max-h-[400px] overflow-y-auto" : "max-h-none"
                        )}
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <table className="w-full text-sm table-fixed">
                        <tbody className="divide-y divide-slate-800/40 text-sm">
                            {displayedAttackers.map((champ, i) => {
                                const soloRate = champ.fights > 0 ? ((champ.fights - champ.deaths) / champ.fights) * 100 : 0;
                                const classColors = getChampionClassColors(champ.class);
                                return (
                                <tr 
                                    key={champ.id} 
                                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                    onClick={() => onSelect({ tab: "matchups", subTab: "attacker", id: champ.id })}
                                >
                                    <td className="px-4 py-3 w-8 text-slate-500 font-mono text-xs">{i + 1}</td>
                                    <td className="px-4 py-3 max-w-0">
                                        <div className="flex items-center gap-3">
                                            <Avatar 
                                                className={cn("h-8 w-8 border-none shrink-0 transition-transform group-hover:scale-110", classColors.bg)}
                                                style={{ boxShadow: `0 0 0 1.5px ${classColors.color}` }}
                                            >
                                                <AvatarImage src={getChampionImageUrl(champ.images, '64')} />
                                                <AvatarFallback>{champ.name.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col min-w-0 truncate">
                                                <span className={cn("font-bold truncate", classColors.text)}>
                                                    {champ.name}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono truncate">{champ.count} uses</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 w-20 text-right">
                                        <span className={cn(
                                            "font-mono font-bold text-sm",
                                            soloRate >= 95 ? "text-emerald-400" : "text-amber-500"
                                        )}>
                                            {soloRate.toFixed(0)}% Solo
                                        </span>
                                    </td>
                                </tr>
                            )})}
                            {topAttackers.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">
                                        No attacker data recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </CardContent>
                {topAttackers.length > 5 && (
                    <div className="p-2 border-t border-slate-800/40 bg-slate-900/10">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs text-slate-500 hover:text-slate-300"
                            onClick={() => setShowAllAttackers(!showAllAttackers)}
                        >
                            {showAllAttackers ? (
                                <><ChevronUp className="w-3 h-3 mr-1" /> Show Less</>
                            ) : (
                                <><ChevronDown className="w-3 h-3 mr-1" /> Show More ({topAttackers.length - 5})</>
                            )}
                        </Button>
                    </div>
                )}
            </Card>

            {/* Hardest Nodes */}
            <Card className="bg-slate-950/50 border-slate-800/60 flex flex-col h-full">
                <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                    <CardTitle className="text-lg font-mono text-slate-200 flex items-center gap-2">
                        <Target className="w-5 h-5 text-amber-500" />
                        Hardest Nodes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <div 
                        className={cn(
                            "transition-all duration-300",
                            showAllNodes ? "max-h-[400px] overflow-y-auto" : "max-h-none"
                        )}
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <table className="w-full text-sm table-fixed">
                        <tbody className="divide-y divide-slate-800/40 text-sm">
                            {displayedNodes.map((node, i) => (
                                <tr 
                                    key={node.nodeNumber} 
                                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                    onClick={() => onSelect({ tab: "defense", subTab: "node", id: node.nodeNumber })}
                                >
                                    <td className="px-4 py-3 w-8 text-slate-500 font-mono text-xs">{i + 1}</td>
                                    <td className="px-4 py-3 max-w-0">
                                        <Badge variant="outline" className="bg-slate-900 text-amber-500 border-amber-500/30 font-mono text-sm group-hover:bg-amber-500/10 transition-colors">
                                            Node {node.nodeNumber}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 w-24 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-red-400 font-bold font-mono flex items-center gap-1 text-sm">
                                                <Skull className="w-3.5 h-3.5" /> {node.deaths}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {node.fights} fights
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {hardestNodes.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">
                                        No node data recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </CardContent>
                {hardestNodes.length > 5 && (
                    <div className="p-2 border-t border-slate-800/40 bg-slate-900/10">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs text-slate-500 hover:text-slate-300"
                            onClick={() => setShowAllNodes(!showAllNodes)}
                        >
                            {showAllNodes ? (
                                <><ChevronUp className="w-3 h-3 mr-1" /> Show Less</>
                            ) : (
                                <><ChevronDown className="w-3 h-3 mr-1" /> Show More ({hardestNodes.length - 5})</>
                            )}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
