"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Shield, Swords, Target, Skull, ChevronDown, ChevronUp, Trophy, TrendingUp } from "lucide-react";
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Deadly Defenders */}
            <Card className="bg-slate-950/40 border-slate-800/60 flex flex-col h-full relative overflow-hidden group/card shadow-xl backdrop-blur-md">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover/card:scale-110 transition-transform duration-1000">
                    <Shield className="w-24 h-24 text-red-500 -rotate-12" />
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 via-red-500/20 to-transparent" />
                
                <CardHeader className="pb-4 pt-6 border-b border-slate-800/60 bg-slate-900/40 relative z-10">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-slate-300 flex items-center gap-2.5">
                            <Shield className="w-4 h-4 text-red-500" />
                            Deadliest Defenders
                        </CardTitle>
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[9px] font-black uppercase italic">
                            Top Threat
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-hidden relative z-10">
                    <div 
                        className={cn(
                            "transition-all duration-500 ease-in-out",
                            showAllDefenders ? "max-h-[500px] overflow-y-auto" : "max-h-none"
                        )}
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <table className="w-full text-sm table-fixed">
                        <tbody className="divide-y divide-slate-800/30 text-sm">
                            {displayedDefenders.map((champ, i) => {
                                const classColors = getChampionClassColors(champ.class);
                                const lethality = (champ.deaths / (champ.fights || 1));
                                return (
                                <tr 
                                    key={champ.id} 
                                    className="hover:bg-red-500/[0.03] transition-all duration-300 cursor-pointer group/row border-l-2 border-l-transparent hover:border-l-red-500"
                                    onClick={() => onSelect({ tab: "defense", subTab: "defender", id: champ.id })}
                                >
                                    <td className="px-4 py-4 w-10 text-slate-600 font-mono text-[10px] font-black italic">{i + 1}</td>
                                    <td className="px-2 py-4 max-w-0">
                                        <div className="flex items-center gap-3">
                                            <div className="relative shrink-0">
                                                <Avatar 
                                                    className={cn("h-10 w-10 border-none transition-transform duration-500 group-hover/row:scale-110 shadow-lg", classColors.bg)}
                                                    style={{ boxShadow: `0 0 10px ${classColors.color}40`, border: `1.5px solid ${classColors.color}` }}
                                                >
                                                    <AvatarImage src={getChampionImageUrl(champ.images, '64')} />
                                                    <AvatarFallback className="text-[10px]">{champ.name.substring(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                {i === 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />}
                                            </div>
                                            <div className="flex flex-col min-w-0 truncate">
                                                <span className={cn("font-black uppercase italic tracking-tight text-sm truncate group-hover/row:translate-x-1 transition-transform duration-300", classColors.text)}>
                                                    {champ.name}
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Progress value={Math.min(100, lethality * 50)} className="h-1 w-12 bg-slate-800" indicatorStyle={{ backgroundColor: classColors.color }} />
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Level {(lethality * 10).toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 w-24 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-red-400 font-black font-mono flex items-center gap-1 text-base italic leading-none">
                                                <Skull className="w-3.5 h-3.5" /> {champ.deaths}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-tighter mt-1 opacity-70">
                                                K/D {lethality.toFixed(2)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {topDefenders.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-12 text-center">
                                        <Shield className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-20" />
                                        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">No deployment data</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </CardContent>
                
                {topDefenders.length > 5 && (
                    <div className="p-0 border-t border-slate-800/40 bg-slate-900/20 group/btn">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-10 rounded-none text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
                            onClick={() => setShowAllDefenders(!showAllDefenders)}
                        >
                            {showAllDefenders ? (
                                <><ChevronUp className="w-3 h-3 mr-2" /> Compress View</>
                            ) : (
                                <><ChevronDown className="w-3 h-3 mr-2" /> Expand Dossier ({topDefenders.length - 5})</>
                            )}
                        </Button>
                    </div>
                )}
            </Card>

            {/* Top Attackers */}
            <Card className="bg-slate-950/40 border-slate-800/60 flex flex-col h-full relative overflow-hidden group/card shadow-xl backdrop-blur-md">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover/card:scale-110 transition-transform duration-1000">
                    <Swords className="w-24 h-24 text-sky-500 -rotate-12" />
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500/50 via-sky-500/20 to-transparent" />
                
                <CardHeader className="pb-4 pt-6 border-b border-slate-800/60 bg-slate-900/40 relative z-10">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-slate-300 flex items-center gap-2.5">
                            <Swords className="w-4 h-4 text-sky-500" />
                            Elite Attackers
                        </CardTitle>
                        <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-400/30 text-[9px] font-black uppercase italic">
                            MVPs
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-hidden relative z-10">
                    <div 
                        className={cn(
                            "transition-all duration-500 ease-in-out",
                            showAllAttackers ? "max-h-[500px] overflow-y-auto" : "max-h-none"
                        )}
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <table className="w-full text-sm table-fixed">
                        <tbody className="divide-y divide-slate-800/30 text-sm">
                            {displayedAttackers.map((champ, i) => {
                                const soloRate = champ.fights > 0 ? ((champ.fights - champ.deaths) / champ.fights) * 100 : 0;
                                const classColors = getChampionClassColors(champ.class);
                                return (
                                <tr 
                                    key={champ.id} 
                                    className="hover:bg-sky-500/[0.03] transition-all duration-300 cursor-pointer group/row border-l-2 border-l-transparent hover:border-l-sky-500"
                                    onClick={() => onSelect({ tab: "matchups", subTab: "attacker", id: champ.id })}
                                >
                                    <td className="px-4 py-4 w-10 text-slate-600 font-mono text-[10px] font-black italic">{i + 1}</td>
                                    <td className="px-2 py-4 max-w-0">
                                        <div className="flex items-center gap-3">
                                            <div className="relative shrink-0">
                                                <Avatar 
                                                    className={cn("h-10 w-10 border-none transition-transform duration-500 group-hover/row:scale-110 shadow-lg", classColors.bg)}
                                                    style={{ boxShadow: `0 0 10px ${classColors.color}40`, border: `1.5px solid ${classColors.color}` }}
                                                >
                                                    <AvatarImage src={getChampionImageUrl(champ.images, '64')} />
                                                    <AvatarFallback className="text-[10px]">{champ.name.substring(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                {i < 3 && <div className="absolute -top-1 -right-1"><Trophy className={cn("w-4 h-4", i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-300" : "text-amber-600")} /></div>}
                                            </div>
                                            <div className="flex flex-col min-w-0 truncate">
                                                <span className={cn("font-black uppercase italic tracking-tight text-sm truncate group-hover/row:translate-x-1 transition-transform duration-300", classColors.text)}>
                                                    {champ.name}
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">{champ.count} MISSIONS</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 w-20 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "font-mono font-black text-base italic leading-none",
                                                soloRate >= 95 ? "text-emerald-400" : "text-amber-500"
                                            )}>
                                                {soloRate.toFixed(0)}%
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter mt-1 opacity-70">
                                                SUCCESS
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {topAttackers.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-12 text-center">
                                        <Swords className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-20" />
                                        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">No engagement data</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </CardContent>

                {topAttackers.length > 5 && (
                    <div className="p-0 border-t border-slate-800/40 bg-slate-900/20 group/btn">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-10 rounded-none text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-sky-400 hover:bg-sky-500/5 transition-all"
                            onClick={() => setShowAllAttackers(!showAllAttackers)}
                        >
                            {showAllAttackers ? (
                                <><ChevronUp className="w-3 h-3 mr-2" /> Compress View</>
                            ) : (
                                <><ChevronDown className="w-3 h-3 mr-2" /> Expand Dossier ({topAttackers.length - 5})</>
                            )}
                        </Button>
                    </div>
                )}
            </Card>

            {/* Hardest Nodes */}
            <Card className="bg-slate-950/40 border-slate-800/60 flex flex-col h-full relative overflow-hidden group/card shadow-xl backdrop-blur-md">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover/card:scale-110 transition-transform duration-1000">
                    <Target className="w-24 h-24 text-amber-500 -rotate-12" />
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/50 via-amber-500/20 to-transparent" />
                
                <CardHeader className="pb-4 pt-6 border-b border-slate-800/60 bg-slate-900/40 relative z-10">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-slate-300 flex items-center gap-2.5">
                            <Target className="w-4 h-4 text-amber-500" />
                            Critical Sectors
                        </CardTitle>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px] font-black uppercase italic">
                            High Alert
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-hidden relative z-10">
                    <div 
                        className={cn(
                            "transition-all duration-500 ease-in-out",
                            showAllNodes ? "max-h-[500px] overflow-y-auto" : "max-h-none"
                        )}
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <table className="w-full text-sm table-fixed">
                        <tbody className="divide-y divide-slate-800/30 text-sm">
                            {displayedNodes.map((node, i) => (
                                <tr 
                                    key={node.nodeNumber} 
                                    className="hover:bg-amber-500/[0.03] transition-all duration-300 cursor-pointer group/row border-l-2 border-l-transparent hover:border-l-amber-500"
                                    onClick={() => onSelect({ tab: "defense", subTab: "node", id: node.nodeNumber })}
                                >
                                    <td className="px-4 py-4 w-10 text-slate-600 font-mono text-[10px] font-black italic">{i + 1}</td>
                                    <td className="px-2 py-4 max-w-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-black text-amber-500 group-hover/row:border-amber-500/50 transition-all duration-300 group-hover/row:scale-110 shadow-lg group-hover/row:shadow-amber-500/10">
                                                {node.nodeNumber}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-black uppercase italic tracking-tight text-sm text-slate-200">Sector {node.nodeNumber}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <TrendingUp className="w-3 h-3 text-red-400 opacity-50" />
                                                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">{node.fights} DEPLOYMENTS</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 w-24 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-red-400 font-black font-mono flex items-center gap-1 text-base italic leading-none">
                                                <Skull className="w-3.5 h-3.5" /> {node.deaths}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-tighter mt-1 opacity-70">
                                                LETHAL LOSS
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {hardestNodes.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-12 text-center">
                                        <Target className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-20" />
                                        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">No intelligence reports</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </CardContent>
                
                {hardestNodes.length > 5 && (
                    <div className="p-0 border-t border-slate-800/40 bg-slate-900/20 group/btn">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-10 rounded-none text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-amber-400 hover:bg-amber-500/5 transition-all"
                            onClick={() => setShowAllNodes(!showAllNodes)}
                        >
                            {showAllNodes ? (
                                <><ChevronUp className="w-3 h-3 mr-2" /> Compress View</>
                            ) : (
                                <><ChevronDown className="w-3 h-3 mr-2" /> Expand Dossier ({hardestNodes.length - 5})</>
                            )}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}