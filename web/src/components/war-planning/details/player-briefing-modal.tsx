"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
    Swords, 
    Zap, 
    Download, 
    Film, 
    Play, 
    Info, 
    History,
    ChevronRight,
    Star,
    TriangleAlert,
    X,
    Plus,
    Loader2
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, FightWithNode } from "@cerebro/core/data/war-planning/types";
import { War, WarMapType, ChampionClass } from "@prisma/client";
import { getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
import { ExtraChampion } from "../hooks/use-war-planning";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getFightVideos, getWarMapPng } from "@/app/planning/actions";
import { useToast } from "@/hooks/use-toast";
import { usePlayerColor } from "../player-color-context";
import { Champion } from "@/types/champion";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";

import { getPathInfo } from "@cerebro/core/data/war-planning/path-logic";

interface PlayerBriefingModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    player: PlayerWithRoster | null;
    currentFights: FightWithNode[];
    extraChampions: ExtraChampion[];
    war: War;
    champions: Champion[];
    activeDefensePlan?: { placements: { defenderId: number | null; playerId: string | null }[] } | null;
    isReadOnly?: boolean;
    onAddExtra?: (playerId: string, championId: number) => void;
    onRemoveExtra?: (extraId: string) => void;
}

const FightVideos = ({ fight }: { fight: FightWithNode }) => {
    const [videos, setVideos] = useState<{ url?: string | null; videoId?: string; death?: number; playerName?: string }[]>([]);

    useEffect(() => {
        if (!fight.nodeId || !fight.defenderId || !fight.attackerId) return;

        async function fetchVideos() {
            try {
                const res = await getFightVideos(fight.nodeId, fight.defenderId!, fight.attackerId!);
                setVideos(res);
            } catch (e) {
                console.error("Failed to fetch videos", e);
            }
        }
        fetchVideos();
    }, [fight.nodeId, fight.defenderId, fight.attackerId]);

    if (videos.length === 0) return null;

    return (
        <div className="space-y-1.5 mt-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <History className="h-2.5 w-2.5" /> Historical Fights
            </div>
            <div className="flex flex-wrap gap-2">
                {videos.map((v, i) => (
                    <a 
                        key={i} 
                        href={`/war-videos/${v.videoId}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/30 px-2.5 py-1 rounded-md hover:bg-sky-500/20 hover:shadow-[0_0_8px_rgba(14,165,233,0.3)] transition-all"
                    >
                        <Play className="h-2.5 w-2.5 fill-current" />
                        <span>{v.playerName}</span>
                    </a>
                ))}
            </div>
        </div>
    );
};

export const PlayerBriefingModal = ({
    isOpen,
    onOpenChange,
    player,
    currentFights,
    extraChampions,
    war,
    champions,
    activeDefensePlan,
    isReadOnly = false,
    onAddExtra,
    onRemoveExtra
}: PlayerBriefingModalProps) => {
    const { toast } = useToast();
    const { getPlayerColor } = usePlayerColor();
    const [isDownloading, setIsDownloading] = useState(false);

    const playerFights = useMemo(() => {
        const fights = currentFights.filter(f => f.player?.id === player?.id);
        return fights.sort((a, b) => (a.node?.nodeNumber || 0) - (b.node?.nodeNumber || 0));
    }, [currentFights, player]);

    const prefightTasks = useMemo(() => {
        const tasks = currentFights.filter(f => f.prefightChampions?.some(pf => pf.player?.id === player?.id));
        return tasks.sort((a, b) => (a.node?.nodeNumber || 0) - (b.node?.nodeNumber || 0));
    }, [currentFights, player]);

    const assignedChampions = useMemo(() => {
        if (!player) return [];
        const uniqueChamps = new Map<number, { 
            id: number; 
            name: string; 
            images: any; 
            class: ChampionClass;
            roles: Set<'attacker' | 'prefight' | 'extra'>;
            extraId?: string;
        }>();
        
        // 1. Attackers
        playerFights.forEach(f => {
            if (f.attacker) {
                if (!uniqueChamps.has(f.attacker.id)) {
                    uniqueChamps.set(f.attacker.id, { ...f.attacker, roles: new Set(['attacker']) });
                } else {
                    uniqueChamps.get(f.attacker.id)!.roles.add('attacker');
                }
            }
        });

        // 2. Prefights the player is placing (for self or others)
        currentFights.forEach(f => {
            f.prefightChampions?.forEach(pf => {
                if (pf.player?.id === player.id) {
                    if (!uniqueChamps.has(pf.id)) {
                        const fullChamp = champions.find(c => c.id === pf.id);
                        if (fullChamp) {
                            uniqueChamps.set(pf.id, { 
                                id: pf.id, 
                                name: pf.name, 
                                images: pf.images, 
                                class: fullChamp.class,
                                roles: new Set(['prefight'])
                            });
                        }
                    } else {
                        uniqueChamps.get(pf.id)!.roles.add('prefight');
                    }
                }
            });
        });
        
        // 3. Extras
        extraChampions.filter(ex => ex.playerId === player.id && ex.battlegroup === player.battlegroup).forEach(ex => {
            if (!uniqueChamps.has(ex.championId)) {
                const fullChamp = champions.find(c => c.id === ex.championId);
                if (fullChamp) {
                    uniqueChamps.set(ex.championId, { 
                        id: ex.championId, 
                        name: ex.champion.name, 
                        images: ex.champion.images, 
                        class: fullChamp.class,
                        roles: new Set(['extra']),
                        extraId: ex.id
                    });
                }
            } else {
                uniqueChamps.get(ex.championId)!.roles.add('extra');
                uniqueChamps.get(ex.championId)!.extraId = ex.id;
            }
        });

        return Array.from(uniqueChamps.values()).sort((a, b) => {
            // Sort by role priority: attacker > prefight > extra
            const getScore = (roles: Set<string>) => {
                if (roles.has('attacker')) return 1;
                if (roles.has('prefight')) return 2;
                return 3;
            };
            return getScore(a.roles) - getScore(b.roles);
        });
    }, [player, playerFights, currentFights, extraChampions, champions]);

    const handleDownloadMyMap = async () => {
        if (!player || player.battlegroup === null) return;
        try {
            setIsDownloading(true);
            const base64 = await getWarMapPng(war.id, player.battlegroup, player.id);
            
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${base64}`;
            link.download = `war-map-${player.ingameName}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast({
                title: "Personal Map Downloaded",
                description: "Your personalized attack map has been generated.",
            });
        } catch (e) {
            toast({
                title: "Download Failed",
                description: "Could not generate personal map image.",
                variant: "destructive",
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const totalFights = useMemo(() => {
        const nodes = new Set<number>();
        playerFights.forEach(f => nodes.add(f.node.nodeNumber));
        prefightTasks.forEach(f => nodes.add(f.node.nodeNumber));
        return nodes.size;
    }, [playerFights, prefightTasks]);

    if (!player) return null;

    const playerColor = getPlayerColor(player.id);
    const championLimit = war.mapType === WarMapType.BIG_THING ? 2 : 3;
    const currentCount = assignedChampions.length;
    const isOverLimit = currentCount > championLimit;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] md:max-h-[85vh] flex flex-col p-0 bg-slate-950/95 backdrop-blur-xl border-slate-800/60 shadow-2xl rounded-xl overflow-hidden">
                <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-800/60 bg-slate-900/40 relative shrink-0 rounded-t-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent pointer-events-none rounded-t-xl" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 shadow-lg shrink-0" style={{ borderColor: playerColor, boxShadow: `0 0 15px ${playerColor}40` }}>
                                <AvatarImage src={player.avatar || undefined} />
                                <AvatarFallback className="bg-slate-900 text-base sm:text-lg">
                                    {player.ingameName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-100 drop-shadow-sm truncate">{player.ingameName}</DialogTitle>
                                <DialogDescription className="text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm">
                                    <span>Briefing • BG {player.battlegroup}</span>
                                    {totalFights > 0 && (
                                        <>
                                            <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-700" />
                                            <span className="flex items-center gap-1 font-bold" style={{ color: playerColor }}>
                                                <Swords className="h-3 w-3" />
                                                {totalFights} {totalFights === 1 ? 'Fight' : 'Fights'}
                                            </span>
                                        </>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="bg-slate-900 border-slate-700 hover:bg-slate-800 gap-2 hover:border-slate-500 transition-colors h-8 sm:h-9 text-xs sm:text-sm"
                                onClick={handleDownloadMyMap}
                                disabled={isDownloading}
                            >
                                {isDownloading ? <Loader2 className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-400" /> : <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-400" />}
                                <span className="sm:inline">Download Map</span>
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 w-full min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden custom-scrollbar">
                    {/* RIGHT COLUMN: Roster & Prefights (Shown FIRST on mobile) */}
                    <div className="flex-1 md:w-80 md:flex-none md:overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-950/80 space-y-6 order-first md:order-last">
                        {/* Attacker Roster Information */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 bg-emerald-500/10 rounded-md border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                                    <Star className="h-4 w-4 text-emerald-400" />
                                </div>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">Your Team</h3>
                                {isOverLimit && (
                                    <span className="ml-auto text-[9px] sm:text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                        <TriangleAlert className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                        <span className="hidden sm:inline text-[8px] sm:text-[10px]">Over Limit</span> ({currentCount}/{championLimit})
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {assignedChampions.map(champ => {
                                    const roster = player.roster
                                        .filter(r => r.championId === champ.id)
                                        .sort((a, b) => {
                                            if (a.stars !== b.stars) return b.stars - a.stars;
                                            if (a.rank !== b.rank) return b.rank - a.rank;
                                            if (a.isAscended !== b.isAscended) return a.isAscended ? -1 : 1;
                                            return b.sigLevel - a.sigLevel;
                                        })[0];

                                    const classColors = getChampionClassColors(champ.class);
                                    const isOnDefense = activeDefensePlan?.placements?.some(p => p.defenderId === champ.id && p.playerId === player.id);

                                    return (
                                        <div key={champ.id} className="group flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:bg-slate-900 transition-colors relative overflow-hidden shadow-sm">
                                            <div className="absolute inset-0 bg-gradient-to-r from-slate-800/0 via-slate-800/0 to-slate-800/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                            
                                            <div className="relative z-10 shrink-0">
                                                <Image 
                                                    src={getChampionImageUrlOrPlaceholder(champ.images, '128')} 
                                                    alt={champ.name}
                                                    width={36}
                                                    height={36}
                                                    className={cn(
                                                        "rounded-full border-2 bg-slate-950 shadow-sm sm:w-10 sm:h-10 w-9 h-9", 
                                                        champ.roles.has('extra') && !champ.roles.has('attacker') && !champ.roles.has('prefight') ? "border-pink-500/50" : classColors.border
                                                    )} 
                                                />
                                                {isOnDefense && (
                                                    <div className="absolute -top-1 -right-1 bg-slate-950 rounded-full p-0.5 border border-amber-500/50 z-20 shadow-md">
                                                        <TriangleAlert className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-amber-500 fill-amber-500/20" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 relative z-10">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("text-xs sm:text-sm font-bold truncate drop-shadow-sm", classColors.text)}>{champ.name}</div>
                                                </div>
                                                {roster && (
                                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 mt-0.5 flex-wrap">
                                                        <span className={cn("flex items-center", roster.isAwakened ? "text-slate-300" : "text-yellow-500")}>
                                                            {roster.stars}<Star className="h-2 w-2 fill-current ml-0.5" />
                                                        </span>
                                                        <span className="font-bold text-slate-200">R{roster.rank}</span>
                                                        {roster.isAwakened && roster.sigLevel > 0 && (
                                                            <span className="text-sky-400 font-bold">S{roster.sigLevel}</span>
                                                        )}
                                                        {roster.isAscended && <span className="text-pink-400 font-bold">ASC</span>}
                                                    </div>
                                                )}
                                                <div className="flex gap-1 mt-1.5">
                                                    {champ.roles.has('attacker') && <span className="text-[7px] sm:text-[8px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 px-1 rounded uppercase font-bold">Attack</span>}
                                                    {champ.roles.has('prefight') && <span className="text-[7px] sm:text-[8px] bg-amber-500/20 border border-amber-500/30 text-amber-400 px-1 rounded uppercase font-bold">Prefight</span>}
                                                    {champ.roles.has('extra') && <span className="text-[7px] sm:text-[8px] bg-pink-500/20 border border-pink-500/30 text-pink-400 px-1 rounded uppercase font-bold">Extra</span>}
                                                </div>
                                            </div>
                                            
                                            {/* Remove Extra Button */}
                                            {!isReadOnly && champ.roles.has('extra') && onRemoveExtra && champ.extraId && (
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600 hover:text-red-400 hover:bg-red-500/10 md:opacity-0 group-hover:opacity-100 transition-all relative z-10 shrink-0" 
                                                    onClick={() => onRemoveExtra(champ.extraId!)}
                                                >
                                                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </Button>
                                            )}

                                            {!champ.roles.has('extra') && isOnDefense && (
                                                <div className="px-1.5 sm:px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[8px] sm:text-[9px] font-bold text-amber-500 uppercase relative z-10 shadow-sm shrink-0">
                                                    Defense
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Extra Assignments Management */}
                            {!isReadOnly && onAddExtra && (
                                <div className="mt-3 bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 sm:p-3 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center gap-2 mb-2 relative z-10">
                                        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-pink-400" />
                                        <span className="text-[10px] sm:text-xs font-bold text-slate-300">Add Synergy / Extra</span>
                                    </div>
                                    <div className="relative z-10">
                                        <ChampionCombobox
                                            champions={champions}
                                            value=""
                                            onSelect={(id: string) => onAddExtra(player.id, parseInt(id))}
                                            placeholder="Select champion..."
                                            className="bg-slate-950 border-slate-800 hover:border-slate-700 transition-colors h-8 text-[10px] sm:text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Prefights */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 bg-amber-500/10 rounded-md border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                                    <Zap className="h-4 w-4 text-amber-400" />
                                </div>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">Prefights</h3>
                            </div>

                            {prefightTasks.length === 0 ? (
                                <div className="p-4 bg-slate-900/30 border border-slate-800/60 rounded-xl text-center text-[10px] sm:text-xs text-slate-500 italic">
                                    No prefights to place.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {prefightTasks.map(fight => {
                                        const playerPfs = fight.prefightChampions?.filter(pf => pf.player?.id === player.id) || [];
                                        return playerPfs.map(pf => {
                                            const isForSelf = fight.player?.id === player.id;
                                            return (
                                                <div key={`${fight.id}-${pf.id}`} className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 border-l-2 border-l-amber-500 shadow-sm relative overflow-hidden group hover:bg-slate-900/60 transition-colors">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                                                    <Image 
                                                        src={getChampionImageUrlOrPlaceholder(pf.images, '64')} 
                                                        alt={pf.name}
                                                        width={24}
                                                        height={24}
                                                        className="rounded-full border-2 border-slate-800 relative z-10 shadow-sm sm:w-7 sm:h-7 w-6 h-6 shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0 relative z-10">
                                                        <div className="text-[11px] sm:text-xs text-slate-200 drop-shadow-sm truncate">
                                                            <span className="font-bold text-amber-400">{pf.name}</span>
                                                        </div>
                                                        <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
                                                            {isForSelf ? "Self" : fight.player?.ingameName || '?'} • Node {fight.node.nodeNumber}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* LEFT COLUMN: Attack Assignments */}
                    <div className="flex-1 md:overflow-y-auto custom-scrollbar p-4 sm:p-6 md:border-r border-slate-800/60 bg-slate-950/50 order-last md:order-first">
                        <div className="space-y-6">
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.15)]">
                                        <Swords className="h-4 w-4 text-indigo-400" />
                                    </div>
                                    <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">Attack Assignments</h3>
                                </div>

                                {playerFights.length === 0 ? (
                                    <div className="bg-slate-900/30 rounded-xl border border-slate-800/60 border-dashed p-6 sm:p-8 text-center">
                                        <p className="text-[10px] sm:text-xs text-slate-500 italic">No nodes assigned yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 sm:space-y-4">
                                        {playerFights.map(fight => {
                                            const pathInfo = getPathInfo(fight.node.nodeNumber);
                                            return (
                                                <div key={fight.id} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 sm:p-4 relative overflow-hidden group hover:bg-slate-900/60 hover:border-slate-700/60 transition-all shadow-sm">
                                                    <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
                                                    
                                                    <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                                                        <div className="flex items-center gap-2 sm:gap-2.5">
                                                            <div 
                                                                className="w-1 h-3 sm:h-4 rounded-full" 
                                                                style={{ 
                                                                    backgroundColor: playerColor, 
                                                                    boxShadow: `0 0 8px ${playerColor}60` 
                                                                }} 
                                                            />
                                                            <span className="text-[10px] sm:text-xs font-bold text-slate-200 tracking-tight">Node {fight.node.nodeNumber}</span>
                                                            {pathInfo && (
                                                                <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 bg-slate-800/30 px-1.5 py-0.5 rounded border border-slate-700/30">
                                                                    S{pathInfo.section} P{pathInfo.path}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {fight.node.allocations[0] && (
                                                            <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 truncate max-w-[100px] sm:max-w-[150px]">
                                                                {fight.node.allocations[0].nodeModifier.name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                                                        <div className="flex -space-x-2 sm:-space-x-3 shrink-0">
                                                            <Image 
                                                                src={getChampionImageUrlOrPlaceholder(fight.attacker?.images, '128')} 
                                                                alt={fight.attacker?.name || 'Attacker'}
                                                                width={40}
                                                                height={40}
                                                                className={cn("rounded-full border-2 bg-slate-950 z-20 shadow-md sm:w-12 sm:h-12 w-10 h-10", fight.attacker && getChampionClassColors(fight.attacker.class).border)}
                                                            />
                                                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-950 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-slate-400 border border-slate-800 z-30 self-center shadow-md">VS</div>
                                                            <Image 
                                                                src={getChampionImageUrlOrPlaceholder(fight.defender?.images, '128')} 
                                                                alt={fight.defender?.name || 'Defender'}
                                                                width={40}
                                                                height={40}
                                                                className={cn("rounded-full border-2 bg-slate-950 z-10 shadow-md sm:w-12 sm:h-12 w-10 h-10", fight.defender && getChampionClassColors(fight.defender.class).border)}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs sm:text-sm font-bold text-slate-100 truncate drop-shadow-sm">
                                                                {fight.attacker?.name || '?'} <span className="text-slate-500 font-normal sm:mx-1 mx-0.5">vs</span> {fight.defender?.name || '?'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Prefights used */}
                                                    {fight.prefightChampions && fight.prefightChampions.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2 relative z-10">
                                                            {fight.prefightChampions.map(pf => (
                                                                <div key={pf.id} className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/80 border border-slate-800 rounded-full pr-2.5 sm:pr-3 pl-1 py-0.5 sm:py-1 shadow-sm">
                                                                    <Image 
                                                                        src={getChampionImageUrlOrPlaceholder(pf.images, '64')} 
                                                                        alt={pf.name}
                                                                        width={18}
                                                                        height={18}
                                                                        className="rounded-full sm:w-5 sm:h-5 w-4 h-4"
                                                                    />
                                                                    <span className="text-[8px] sm:text-[9px] text-slate-400 truncate max-w-[80px] sm:max-w-none">
                                                                        <span className="text-slate-200 font-bold">{pf.name}</span>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Fight Notes */}
                                                    {fight.notes && (
                                                        <div className="mt-2.5 sm:mt-3 p-2 sm:p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-md text-[10px] sm:text-[11px] text-amber-200/90 italic flex gap-2 relative z-10">
                                                            <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 mt-0.5 text-amber-400" />
                                                            <span className="line-clamp-3 sm:line-clamp-none">{fight.notes}</span>
                                                        </div>
                                                    )}

                                                    {/* Videos Component */}
                                                    <div className="relative z-10">
                                                        <FightVideos fight={fight} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-3 sm:p-4 bg-slate-900/40 border-t border-slate-800/60 shrink-0">
                    <div className="flex w-full items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-slate-500 min-w-0">
                            <Info className="h-3 w-3 shrink-0" />
                            <span className="truncate">Data based on current assignments.</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors h-8 text-xs shrink-0">
                            Close
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
