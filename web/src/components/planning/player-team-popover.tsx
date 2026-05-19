"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChampionAvatar } from "@/components/champion-avatar";
import type { ChampionCounterData } from "@/app/actions/quest-catalog";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { cn } from "@/lib/utils";
import type { ChampionClass } from "@prisma/client";
import type { EncounterWithRelations, QuestTimelineProps } from "./types";
import { toChampionImages } from "./types";
import type { PlayerPicksMap } from "./quest-timeline-view-model";

export function PlayerTeamSummary({ user, picks, quest, scrollToEncounter }: {
    user: { name: string; avatar: string | null };
    picks: { encounterId: string; champion: ChampionCounterData }[];
    quest: QuestTimelineProps["quest"];
    scrollToEncounter: (id: string) => void;
}) {
    const teamMap = useMemo(() => {
        const map: Record<number, { champion: ChampionCounterData; assignedEncounters: EncounterWithRelations[] }> = {};
        picks.forEach(p => {
            const enc = quest.encounters.find((e) => e.id === p.encounterId);
            if (!enc) return;
            if (!map[p.champion.id]) {
                map[p.champion.id] = { champion: p.champion, assignedEncounters: [] };
            }
            map[p.champion.id].assignedEncounters.push(enc);
        });
        const result = Object.values(map);
        result.forEach(v => v.assignedEncounters.sort((a, b) => a.sequence - b.sequence));
        return result;
    }, [picks, quest.encounters]);

    return (
        <div className="flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-sky-500/30 shadow-lg">
                    {user.avatar ? (
                        <Image src={user.avatar} alt={user.name} fill className="object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 font-bold text-lg">
                            {user.name.charAt(0)}
                        </div>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-base font-black text-white tracking-tight">{user.name}&apos;s Plan</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{teamMap.length} Champions selected</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-950/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {teamMap.map(({ champion, assignedEncounters }) => {
                        const classColors = getChampionClassColors(champion.class as ChampionClass);
                        return (
                            <div
                                key={champion.id}
                                className={cn(
                                    "relative flex flex-col bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden transition-all duration-300",
                                    classColors.hoverBorder.replace('hover:', '')
                                )}
                            >
                                <div className="p-3 flex items-center gap-3">
                                    <div className="shrink-0">
                                        <ChampionAvatar
                                            images={toChampionImages(champion.images)}
                                            name={champion.name}
                                            stars={0}
                                            rank={0}
                                            championClass={champion.class as ChampionClass}
                                            size="md"
                                            showRank={false}
                                            showStars={false}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={cn("text-[11px] font-black uppercase truncate tracking-wider", classColors.text)}>
                                            {champion.name}
                                        </h4>
                                        <div className="flex items-center gap-1.5">
                                            {assignedEncounters.length > 0 ? (
                                                <>
                                                    <div className="h-1 w-1 rounded-full bg-slate-700" />
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{assignedEncounters.length} {assignedEncounters.length === 1 ? 'Fight' : 'Fights'}</span>
                                                </>
                                            ) : (
                                                <span className="text-[9px] text-sky-500/80 font-bold uppercase tracking-widest flex items-center gap-1">
                                                    <div className="w-1 h-1 rounded-full bg-sky-500" />
                                                    Synergy
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="px-3 pb-3">
                                    {assignedEncounters.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/50 shadow-inner">
                                            {assignedEncounters.map((enc) => {
                                                const diffBorder = enc.difficulty === "HARD"
                                                    ? "border-red-700/60"
                                                    : enc.difficulty === "EASY"
                                                        ? "border-emerald-700/50"
                                                        : enc.difficulty === "NORMAL"
                                                            ? "border-amber-700/50"
                                                            : "border-slate-700";
                                                const diffBg = enc.difficulty === "HARD"
                                                    ? "bg-red-950/60"
                                                    : enc.difficulty === "EASY"
                                                        ? "bg-emerald-950/60"
                                                        : enc.difficulty === "NORMAL"
                                                            ? "bg-amber-950/60"
                                                            : "bg-slate-800";
                                                return (
                                                    <div
                                                        key={enc.id}
                                                        className={cn("relative w-8 h-8 rounded-lg border overflow-hidden cursor-pointer hover:border-sky-500 transition-all hover:scale-105 active:scale-95 group/tgt-mini", diffBorder, diffBg)}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            scrollToEncounter(enc.id);
                                                        }}
                                                        title={`Fight ${enc.sequence}: ${enc.defender?.name || "Unknown"}`}
                                                    >
                                                        {enc.defender ? (
                                                            <Image src={getChampionImageUrlOrPlaceholder(enc.defender.images, '64')} alt={enc.defender.name} fill className="object-cover group-hover/tgt-mini:scale-110 transition-transform" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-slate-800"><ShieldAlert className="w-3 h-3 text-slate-500" /></div>
                                                        )}
                                                        <div className="absolute inset-0 bg-sky-500/10 opacity-0 group-hover/tgt-mini:opacity-100 transition-opacity" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-800/30 border-dashed text-center">
                                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest italic">Unassigned</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function MultiPlayerPopover({
    users,
    quest,
    scrollToEncounter,
    playerPicksMap
}: {
    users: { id: string; name: string; avatar: string | null }[];
    quest: QuestTimelineProps["quest"];
    scrollToEncounter: (id: string) => void;
    playerPicksMap: PlayerPicksMap;
}) {
    const [selectedUser, setSelectedUser] = useState<typeof users[0] | null>(null);

    if (selectedUser) {
        return (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/40 flex items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUser(null)}
                        className="h-7 px-2 text-[10px] font-black uppercase text-slate-400 hover:text-white gap-1.5"
                    >
                        <ChevronLeft className="w-3 h-3" /> Back to List
                    </Button>
                </div>
                <PlayerTeamSummary
                    user={selectedUser}
                    picks={playerPicksMap[selectedUser.id]?.picks || []}
                    quest={quest}
                    scrollToEncounter={scrollToEncounter}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col max-h-[60vh] animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="p-3 border-b border-slate-800 bg-slate-900/60">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Suggested By</h4>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {users.map((user) => (
                    <button
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/60 transition-colors text-left group"
                    >
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700 group-hover:border-sky-500/50 transition-colors">
                            {user.avatar ? (
                                <Image src={user.avatar} alt={user.name} fill className="object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                                    {user.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{user.name}</span>
                            <span className="text-[9px] text-slate-500 font-medium">Click to see plan</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-600 group-hover:text-sky-400 transition-colors" />
                    </button>
                ))}
            </div>
        </div>
    );
}
