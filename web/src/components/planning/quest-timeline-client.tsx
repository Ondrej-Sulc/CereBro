"use client";
import { EncounterCard } from "./encounter-card/EncounterCard";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Search, X, Trash2, Crosshair, Youtube, Users, Share2, Check, Target, Swords, Ban, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getShareablePlanId, savePlayerQuestCounter, savePlayerQuestSynergy, clearAllQuestCounters } from "@/app/actions/quests";
import type { PickCounterWithChampion, ChampionCounterData } from "@/app/actions/quests";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder, getStarBorderClass } from "@/lib/championHelper";
import { ChampionAvatar } from "@/components/champion-avatar";
import { UpdatedChampionItem } from "@/components/UpdatedChampionItem";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { cn } from "@/lib/utils";
import { MultiSelectFilter } from "@/components/ui/filters";
import { useToast } from "@/hooks/use-toast";
import {
    EncounterWithRelations,
    RosterWithChampion,
    QuestTimelineProps,
    toChampionImages,
    SynergyWithChampion
} from "./types";
import {
    isChampionValidForEncounterOrQuest,
    getValidRosterCountForChampion
} from "./utils";

import type { ChampionClass } from "@prisma/client";
import type { Champion } from "@/types/champion";

const CLASSES = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"] as const;

const PlayerTeamSummary = ({ user, picks, quest, scrollToEncounter }: { 
    user: { name: string; avatar: string | null };
    picks: { encounterId: string; champion: ChampionCounterData }[];
    quest: QuestTimelineProps["quest"];
    scrollToEncounter: (id: string) => void;
}) => {
    // Group picks by champion
    const teamMap = useMemo(() => {
        const map: Record<number, { champion: ChampionCounterData; assignedEncounters: any[] }> = {};
        picks.forEach(p => {
            if (!map[p.champion.id]) {
                map[p.champion.id] = { champion: p.champion, assignedEncounters: [] };
            }
            const enc = quest.encounters.find((e: any) => e.id === p.encounterId);
            if (enc) map[p.champion.id].assignedEncounters.push(enc);
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
                    <span className="text-base font-black text-white tracking-tight">{user.name}'s Plan</span>
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
                                            {assignedEncounters.map((enc: any) => {
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
};

const MultiPlayerPopover = ({ 
    users, 
    quest, 
    scrollToEncounter, 
    playerPicksMap 
}: { 
    users: { id: string; name: string; avatar: string | null }[];
    quest: QuestTimelineProps["quest"];
    scrollToEncounter: (id: string) => void;
    playerPicksMap: any;
}) => {
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
};

const isReadOnlyRosterEntry = (value: unknown): value is RosterWithChampion => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.id !== "string") return false;
    if (typeof candidate.championId !== "number") return false;

    const champion = candidate.champion;
    if (!champion || typeof champion !== "object") return false;
    const champCandidate = champion as Record<string, unknown>;
    return (
        typeof champCandidate.id === "number" &&
        typeof champCandidate.name === "string"
    );
};

const isChampionUnavailableForEncounter = ({
    userChamp,
    encounterId,
    selections,
    roster,
    quest,
    encounter
}: {
    userChamp: RosterWithChampion | undefined;
    encounterId: string;
    selections: Record<string, string | null>;
    roster: RosterWithChampion[];
    quest: QuestTimelineProps["quest"];
    encounter: EncounterWithRelations;
}): boolean => {
    if (!userChamp || quest.teamLimit !== null || selections[encounterId] === userChamp.id) {
        return false;
    }

    const otherSelectionsCount = Object.entries(selections).reduce((acc, [encId, rid]) => {
        if (encId !== encounterId && rid !== null) {
            const r = roster.find(re => re.id === rid);
            if (r?.championId === userChamp.championId) {
                return acc + 1;
            }
        }
        return acc;
    }, 0);

    const validRosterCount = getValidRosterCountForChampion(userChamp.championId, roster, quest, encounter);
    return otherSelectionsCount >= validRosterCount;
};

export default function QuestTimelineClient({ quest, roster = [], savedEncounters = [], savedSynergies = [], popularCounters = {}, featuredPicks = {}, alliancePicks = {}, filterMetadata = { tags: [], abilityCategories: [], abilities: [], immunities: [] }, readOnly = false, rosterMap = {}, initialSelections }: QuestTimelineProps) {
    const { toast } = useToast();
    const headerRef = useRef<HTMLDivElement>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClass, setSelectedClass] = useState<ChampionClass | null>(null);
    const [isTeamExpanded, setIsTeamExpanded] = useState(false);
    const [showVideoId, setShowVideoId] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [encounterTabs, setEncounterTabs] = useState<Record<string, 'recommended' | 'featured' | 'alliance'>>({});
    const [isRosterExpanded, setIsRosterExpanded] = useState(false);
    const [isClearPlanOpen, setIsClearPlanOpen] = useState(false);
    const [isNodesCollapsed, setIsNodesCollapsed] = useState(false);
    const [isSynergyPickerOpen, setIsSynergyPickerOpen] = useState(false);

    // Track synergy champions locally
    const [synergyIds, setSynergyIds] = useState<number[]>(() => savedSynergies.map(s => s.championId));

    // Champion Removal State
    const [championToRemove, setChampionToRemove] = useState<{
        rosterId: string;
        championId: number;
        assignedEncounters: string[];
        isSynergy: boolean;
        championName: string;
    } | null>(null);

    // Shared helper for champion removal logic
    const removeTeamMemberLogic = async (target: { rosterId: string; championId: number; assignedEncounters: string[]; isSynergy: boolean }) => {
        const { championId, assignedEncounters, isSynergy } = target;

        try {
            // Wait for all remote operations to complete successfully FIRST
            const promises: Promise<any>[] = [];
            
            if (isSynergy) {
                promises.push(savePlayerQuestSynergy(quest.id, championId, true));
            }

            if (assignedEncounters.length > 0) {
                assignedEncounters.forEach(encId => {
                    promises.push(savePlayerQuestCounter(quest.id, encId, null));
                });
            }

            await Promise.all(promises);

            // If we reach here, all API calls succeeded. Now update local state.
            if (isSynergy) {
                setSynergyIds(prev => prev.filter(id => id !== championId));
            }

            if (assignedEncounters.length > 0) {
                setSelections(prev => {
                    const next = { ...prev };
                    assignedEncounters.forEach(encId => {
                        next[encId] = null;
                    });
                    return next;
                });
                toast({ title: "Assignments Cleared", description: "Champion has been unassigned from fights." });
            } else if (isSynergy) {
                toast({ title: "Synergy Removed", description: "Champion has been removed from synergy." });
            }
            
        } catch (error) {
            console.error("Failed to remove champion completely", error);
            toast({ title: "Error", description: "Failed to remove champion completely. Some operations may have failed.", variant: "destructive" });
        }
    };

    const executeRemoveTeamMember = async () => {
        if (!championToRemove) return;
        await removeTeamMemberLogic(championToRemove);
        setChampionToRemove(null);
    };

    const executeClearPlan = async () => {
        try {
            await clearAllQuestCounters(quest.id);
            setSelections({});
            toast({ title: "Plan Cleared", description: "All counter selections have been removed." });
        } catch {
            toast({ title: "Error", description: "Failed to clear the plan.", variant: "destructive" });
        }
    };

    // Refactored helper for immediate execution
    const confirmAndRemoveTeamMember = async (target: { rosterId: string, championId: number, assignedEncounters: string[], isSynergy: boolean }) => {
        await removeTeamMemberLogic(target);
    };

    const initiateRemoveTeamMember = (rosterId: string, championId: number, championName: string) => {
        const assignedEncounters = Object.entries(selections)
            .filter(([encId, rId]) => rId === rosterId)
            .map(([encId]) => encId);
            
        const isSynergy = synergyIds.includes(championId);

        if (assignedEncounters.length > 1) {
            setChampionToRemove({ rosterId, championId, assignedEncounters, isSynergy, championName });
        } else {
            confirmAndRemoveTeamMember({ rosterId, championId, assignedEncounters, isSynergy });
        }
    };

    // Group picks by player for the PlayerTeamPopover
    const playerPicksMap = useMemo(() => {
        const map: Record<string, { 
            name: string;
            avatar: string | null;
            picks: { encounterId: string; champion: ChampionCounterData }[] 
        }> = {};

        const addPicks = (picksMap: Record<string, any[]>) => {
            Object.entries(picksMap).forEach(([encId, counters]) => {
                counters.forEach(c => {
                    c.pickedBy?.forEach((user: any) => {
                        if (!map[user.id]) {
                            map[user.id] = { name: user.name, avatar: user.avatar, picks: [] };
                        }
                        // Only add if not already present for this encounter
                        if (!map[user.id].picks.some(p => p.encounterId === encId)) {
                            map[user.id].picks.push({ encounterId: encId, champion: c.champion });
                        }
                    });
                });
            });
        };

        addPicks(featuredPicks);
        addPicks(alliancePicks);
        return map;
    }, [featuredPicks, alliancePicks]);

    useEffect(() => {
        const handleScroll = () => {
            if (!headerRef.current) return;
            const rect = headerRef.current.getBoundingClientRect();
            // Sticking happens at top-[68px]. 
            // rect.top is relative to viewport.
            setIsScrolled(rect.top <= 69); // 68 + 1px buffer
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handleShare = async () => {
        if (quest.status !== "VISIBLE") return;
        setIsSharing(true);
        try {
            const planId = await getShareablePlanId(quest.id);
            const url = `${window.location.origin}/planning/quests/shared/${planId}`;
            await navigator.clipboard.writeText(url);
            setShareSuccess(true);
            toast({ title: "Link Copied!", description: "Share link copied to clipboard." });
            setTimeout(() => setShareSuccess(false), 2000);
        } catch {
            toast({ title: "Error", description: "Failed to generate share link.", variant: "destructive" });
        } finally {
            setIsSharing(false);
        }
    };

    // Difficulty Filter State
    const [difficultyFilter, setDifficultyFilter] = useState<("EASY" | "NORMAL" | "HARD")[]>([]);

    const toggleDifficultyFilter = (d: "EASY" | "NORMAL" | "HARD") => {
        setDifficultyFilter(prev =>
            prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
        );
    };

    const filteredEncounters = useMemo(() => {
        if (difficultyFilter.length === 0) return quest.encounters;
        return quest.encounters.filter(e => difficultyFilter.includes(e.difficulty as "EASY" | "NORMAL" | "HARD"));
    }, [quest.encounters, difficultyFilter]);

    // Advanced Filter States
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [tagFilter, setTagFilter] = useState<string[]>([]);
    const [tagLogic, setTagLogic] = useState<'AND' | 'OR'>('AND');
    const [abilityCategoryFilter, setAbilityCategoryFilter] = useState<string[]>([]);
    const [abilityCategoryLogic, setAbilityCategoryLogic] = useState<'AND' | 'OR'>('OR');
    const [abilityFilter, setAbilityFilter] = useState<string[]>([]);
    const [abilityLogic, setAbilityLogic] = useState<'AND' | 'OR'>('AND');
    const [immunityFilter, setImmunityFilter] = useState<string[]>([]);
    const [immunityLogic, setImmunityLogic] = useState<'AND' | 'OR'>('AND');

    // Track selections locally for immediate UI updates
    const [selections, setSelections] = useState<Record<string, string | null>>(() => {
        const initial: Record<string, string | null> = {};
        
        if (readOnly) {
            // In read-only mode, we use the rosterMap to get the IDs directly
            Object.keys(initialSelections || {}).forEach(encId => {
                const rosterEntry = rosterMap[encId];
                initial[encId] = isReadOnlyRosterEntry(rosterEntry) ? rosterEntry.id : null;
            });
            return initial;
        }

        // For interactive mode, initialize from savedEncounters and find matching roster entries
        const availableRoster = [...roster];
        savedEncounters.forEach(se => {
            if (se.selectedChampionId) {
                const encounter = quest.encounters.find(e => e.id === se.questEncounterId);
                const rosterIndex = availableRoster.findIndex(r => 
                    r.championId === se.selectedChampionId && 
                    isChampionValidForEncounterOrQuest(r, quest, encounter)
                );
                
                if (rosterIndex !== -1) {
                    initial[se.questEncounterId] = availableRoster[rosterIndex].id;
                    // Remove from available so it's not assigned to another encounter
                    // ONLY if it's an infinite quest (no team limit)
                    if (quest.teamLimit === null) {
                        availableRoster.splice(rosterIndex, 1);
                    }
                } else {
                    initial[se.questEncounterId] = null;
                }
            } else {
                initial[se.questEncounterId] = null;
            }
        });
        return initial;
    });

    const getStickyOffset = useCallback(() => {
        const stickyTeam = document.querySelector('[data-sticky-team]');
        return stickyTeam
            ? stickyTeam.getBoundingClientRect().bottom + 12
            : (window.matchMedia('(min-width: 768px)').matches ? 130 : 70);
    }, []);

    // Scroll an encounter card into view, accounting for the sticky team panel
    const scrollToCard = useCallback((id: string, delay = 0) => {
        const doScroll = () => {
            const element = document.getElementById(`encounter-${id}`);
            if (!element) return;
            const offset = getStickyOffset();
            const rect = element.getBoundingClientRect();
            window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: 'smooth' });
        };
        delay > 0 ? setTimeout(doScroll, delay) : requestAnimationFrame(doScroll);
    }, [getStickyOffset]);

    const toggleExpand = (id: string) => {
        const isOpening = expandedId !== id;
        if (isOpening) {
            setShowVideoId(null);
            const newElement = document.getElementById(`encounter-${id}`);
            if (newElement) {
                const offset = getStickyOffset();
                const newRect = newElement.getBoundingClientRect();
                let targetScroll = window.scrollY + newRect.top - offset;

                // If the currently open card is above the new card in the list,
                // its collapse will shift the new card upward by (expandedHeight - collapsedHeight).
                // Pre-subtract that delta so the new card header lands at `offset` once
                // the animation ends — regardless of whether the old card is on-screen or not.
                if (expandedId) {
                    const oldElement = document.getElementById(`encounter-${expandedId}`);
                    if (oldElement) {
                        const oldRect = oldElement.getBoundingClientRect();
                        if (oldRect.top < newRect.top) {
                            const headerEl = oldElement.querySelector<HTMLElement>('[role="button"]');
                            const collapsedHeight = headerEl ? headerEl.getBoundingClientRect().height : 100;
                            const delta = Math.max(0, oldRect.height - collapsedHeight);
                            targetScroll -= delta;
                        }
                    }
                }

                window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'instant' });
            }
        }
        setExpandedId(prev => prev === id ? null : id);
    };

    const scrollToEncounter = (id: string) => {
        setExpandedId(id);
        setIsTeamExpanded(false);
        scrollToCard(id, 100);
    };

    const filteredGlobalRoster = useMemo(() => {
        return roster.filter(r => {
            // Search query
            if (searchQuery && !r.champion.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.champion.shortName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            // Class filter
            if (selectedClass && r.champion.class !== selectedClass) return false;

            // Pre-compute sets for performance with existence checks
            const champAbilities = r.champion.abilities || [];
            const abilityEntries = champAbilities.filter(a => a.type === 'ABILITY');
            const immunityEntries = champAbilities.filter(a => a.type === 'IMMUNITY');
            const champTags = (r.champion.tags || []).map(t => t.name);

            // Advanced filters
            if (tagFilter.length > 0) {
                if (tagLogic === 'AND') { if (!tagFilter.every(t => champTags.includes(t))) return false; }
                else { if (!tagFilter.some(t => champTags.includes(t))) return false; }
            }

            if (abilityCategoryFilter.length > 0) {
                const championCategories = new Set(
                    champAbilities.flatMap(a => a.ability?.categories?.map(c => c.name) || [])
                );
                if (abilityCategoryLogic === 'AND') { if (!abilityCategoryFilter.every(c => championCategories.has(c))) return false; }
                else { if (!abilityCategoryFilter.some(c => championCategories.has(c))) return false; }
            }

            if (abilityFilter.length > 0) {
                const champAbilityNames = new Set(abilityEntries.map(a => a.ability?.name).filter(Boolean));
                if (abilityLogic === 'AND') { if (!abilityFilter.every(req => champAbilityNames.has(req))) return false; }
                else { if (!abilityFilter.some(req => champAbilityNames.has(req))) return false; }
            }

            if (immunityFilter.length > 0) {
                const champImmunityNames = new Set(immunityEntries.map(a => a.ability?.name).filter(Boolean));
                if (immunityLogic === 'AND') { if (!immunityFilter.every(req => champImmunityNames.has(req))) return false; }
                else { if (!immunityFilter.some(req => champImmunityNames.has(req))) return false; }
            }

            return true;
        });
    }, [roster, searchQuery, selectedClass, tagFilter, tagLogic, abilityCategoryFilter, abilityCategoryLogic, abilityFilter, abilityLogic, immunityFilter, immunityLogic]);

    const activeFiltersCount = useMemo(() => {
        return tagFilter.length + abilityCategoryFilter.length + abilityFilter.length + immunityFilter.length;
    }, [tagFilter, abilityCategoryFilter, abilityFilter, immunityFilter]);

    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedClass(null);
        setTagFilter([]);
        setAbilityCategoryFilter([]);
        setAbilityFilter([]);
        setImmunityFilter([]);
    };

    const handleSelectCounter = async (encounterId: string, rosterId: string) => {
        const previousRosterId = selections[encounterId];
        const rosterEntry = roster.find(r => r.id === rosterId);
        if (!rosterEntry) return;
        
        const championId = rosterEntry.championId;

        // If selecting a NEW roster entry (not unselecting, and not already selected for this fight)
        if (previousRosterId !== rosterId) {
            // Check if this specific roster entry is already in the team for another fight
            const isAlreadyInTeam = Object.values(selections).includes(rosterId);

            if (quest.teamLimit !== null) {
                // Check if the CHAMPION is already in the team (either as counter or synergy)
                const isChampInTeam = Object.values(selections).some(rid => {
                    if (!rid) return false;
                    return roster.find(r => r.id === rid)?.championId === championId;
                }) || synergyIds.includes(championId);

                // If they aren't in the team, and adding them would exceed the limit, block it
                if (!isChampInTeam && selectedTeam.length >= quest.teamLimit) {
                    toast({
                        title: "Team Limit Reached",
                        description: `You can only select up to ${quest.teamLimit} champions for this quest.`,
                        variant: "destructive"
                    });
                    return; // Stop here, do not select
                }
            } else {
                // Infinite team limit: check if this specific roster entry is already used
                if (isAlreadyInTeam) {
                    toast({
                        title: "Rarity Already Used",
                        description: `This specific rarity of the champion is already used in another fight.`,
                        variant: "destructive"
                    });
                    return; // Stop here
                }
            }
        }

        const newValue = previousRosterId === rosterId ? null : rosterId;
        const newChampValue = newValue ? roster.find(r => r.id === newValue)?.championId || null : null;
        
        setSelections(prev => ({ ...prev, [encounterId]: newValue }));

        // Autoclose the card if a selection was made
        if (newValue !== null) {
            // Snap to card header instantly BEFORE closing so the collapse animation
            // plays in-view rather than causing a layout-shift scroll jump
            const element = document.getElementById(`encounter-${encounterId}`);
            if (element) {
                const offset = getStickyOffset();
                const rect = element.getBoundingClientRect();
                window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: 'instant' });
            }
            setExpandedId(null);
        }

        try {
            await savePlayerQuestCounter(quest.id, encounterId, newChampValue);
        } catch (error) {
            console.error("Failed to save counter selection", error);
            setSelections(prev => ({ ...prev, [encounterId]: previousRosterId }));
            toast({ title: "Error", description: "Failed to save selection.", variant: "destructive" });
        }
    };

    const handleSelectSynergy = async (championId: number) => {
        const isRemoving = synergyIds.includes(championId);
        
        if (!isRemoving && quest.teamLimit !== null && selectedTeam.length >= quest.teamLimit) {
            // Check if they are already in the team as a counter
            const isAlreadyInTeam = Object.values(selections).some(rid => {
                if (!rid) return false;
                return roster.find(r => r.id === rid)?.championId === championId;
            });

            if (!isAlreadyInTeam) {
                toast({
                    title: "Team Limit Reached",
                    description: `You can only select up to ${quest.teamLimit} champions for this quest.`,
                    variant: "destructive"
                });
                return;
            }
        }

        setSynergyIds(prev => isRemoving 
            ? prev.filter(id => id !== championId)
            : [...prev, championId]
        );

        try {
            await savePlayerQuestSynergy(quest.id, championId, isRemoving);
        } catch (error) {
            console.error("Failed to save synergy selection", error);
            setSynergyIds(prev => isRemoving 
                ? [...prev, championId]
                : prev.filter(id => id !== championId)
            );
            toast({ title: "Error", description: "Failed to save synergy.", variant: "destructive" });
        }
    };

    /** Resolve a roster item for a given roster ID — works for both interactive and readOnly modes */
    const resolveRosterItem = useCallback((rosterId: string, encounterId: string): RosterWithChampion | undefined => {
        if (readOnly) {
            const rosterEntry = rosterMap[encounterId];
            return isReadOnlyRosterEntry(rosterEntry) ? rosterEntry : undefined;
        }
        return roster.find(r => r.id === rosterId);
    }, [readOnly, roster, rosterMap]);

    const selectedTeam = useMemo(() => {
        const teamMap = new Map<string, RosterWithChampion>();
        
        // 1. Add champions selected for encounters
        Object.entries(selections).forEach(([encId, rosterId]) => {
            if (rosterId !== null) {
                const r = resolveRosterItem(rosterId, encId);
                if (r) {
                    teamMap.set(r.id, r);
                }
            }
        });

        // 2. Add synergy champions (if not already added as counters)
        synergyIds.forEach(champId => {
            const isAlreadyInTeam = Array.from(teamMap.values()).some(r => r.championId === champId);
            
            if (!isAlreadyInTeam) {
                // Find "best" version in roster for synergy
                let bestRosterEntry = roster
                    .filter(r => r.championId === champId)
                    .sort((a, b) => b.stars - a.stars || b.rank - a.rank)[0];
                
                if (!bestRosterEntry) {
                    // Fallback to savedSynergies to create a placeholder if roster is missing
                    const savedSyn = savedSynergies.find(s => s.championId === champId);
                    if (savedSyn) {
                        bestRosterEntry = {
                            id: `synergy-${champId}`,
                            playerId: "",
                            championId: champId,
                            stars: 0,
                            rank: 0,
                            sigLevel: 0,
                            isAwakened: false,
                            isAscended: false,
                            ascensionLevel: 0,
                            powerRating: 0,
                            champion: savedSyn.champion as any,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };
                    }
                }

                if (bestRosterEntry) {
                    teamMap.set(bestRosterEntry.id, bestRosterEntry);
                }
            }
        });
        
        return Array.from(teamMap.values());
    }, [selections, synergyIds, resolveRosterItem, roster, savedSynergies]);

    const renderChampionItem = (c: Champion, encounter: EncounterWithRelations, popularityLabel?: string, isRecommendedTab?: boolean, isCompact?: boolean) => {
        if (readOnly) {
            // In readOnly mode, just show the champion reference without roster matching
            return (
                <UpdatedChampionItem
                    item={{
                        stars: 0,
                        rank: 0,
                        champion: {
                            id: c.id,
                            name: c.shortName || c.name,
                            championClass: c.class,
                            images: toChampionImages(c.images)
                        }
                    }}
                    isRecommended
                    popularityLabel={popularityLabel}
                />
            );
        }

        // Find highest version in roster that matches restrictions
        const validRosterEntries = roster
            .filter(r => r.championId === c.id && isChampionValidForEncounterOrQuest(r, quest, encounter))
            .sort((a, b) => b.stars - a.stars || b.rank - a.rank);

        // Best version that is either unused or used in THIS encounter
        const userChamp = validRosterEntries.find(r => 
            !Object.values(selections).includes(r.id) || 
            selections[encounter.id] === r.id
        ) || validRosterEntries[0];

        const isSelected = !!userChamp && selections[encounter.id] === userChamp.id;
        
        // Check if any version of this champion is in the team
        const isChampInTeam = Object.values(selections).some(rid => {
            if (!rid) return false;
            return roster.find(r => r.id === rid)?.championId === c.id;
        });
        
        const isUnavailable = isChampionUnavailableForEncounter({
            userChamp,
            encounterId: encounter.id,
            selections,
            roster,
            quest,
            encounter
        });

        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    if (userChamp && !isUnavailable) {
                        handleSelectCounter(encounter.id, userChamp.id);
                    }
                }}
                className={cn(
                    "flex flex-col gap-1.5", 
                    isUnavailable ? "cursor-not-allowed" : "cursor-pointer group"
                )}
            >
                <div className="relative">
                    <UpdatedChampionItem
                        item={userChamp ? {
                            stars: userChamp.stars,
                            rank: userChamp.rank,
                            isAwakened: userChamp.isAwakened,
                            sigLevel: userChamp.sigLevel,
                            powerRating: userChamp.powerRating,
                            champion: {
                                id: userChamp.champion.id,
                                name: userChamp.champion.shortName || userChamp.champion.name,
                                championClass: userChamp.champion.class,
                                    images: toChampionImages(userChamp.champion.images)
                            },
                            isAscended: userChamp.isAscended,
                            ascensionLevel: userChamp.ascensionLevel
                        } : {
                            stars: 0,
                            rank: 0,
                            champion: {
                                id: c.id,
                                name: c.shortName || c.name,
                                championClass: c.class,
                                images: toChampionImages(c.images)
                            }
                        }}
                        isSelected={isSelected}
                        isRecommended={!isSelected && isRecommendedTab}
                        isMissing={!userChamp}
                        isInTeam={isChampInTeam}
                        isUnavailable={isUnavailable}
                        popularityLabel={!isCompact ? popularityLabel : undefined}
                    />
                </div>
            </div>
        );
    };

    const renderListPick = (p: PickCounterWithChampion, encounter: EncounterWithRelations) => {
        const validRosterEntries = roster
            .filter(r => r.championId === p.championId && isChampionValidForEncounterOrQuest(r, quest, encounter))
            .sort((a, b) => b.stars - a.stars || b.rank - a.rank);
        const userChamp = validRosterEntries.find(r => 
            !Object.values(selections).includes(r.id) || 
            selections[encounter.id] === r.id
        ) || validRosterEntries[0];
        
        const isSelected = !!userChamp && selections[encounter.id] === userChamp.id;
        const isInTeam = Object.values(selections).some(rid => rid !== null && roster.find(r => r.id === rid)?.championId === p.championId);

        const isUnavailable = isChampionUnavailableForEncounter({
            userChamp,
            encounterId: encounter.id,
            selections,
            roster,
            quest,
            encounter
        });

        const users = p.pickedBy || [];
        const MAX_SIDEBAR_USERS = 3;
        const displayUsers = users.slice(0, MAX_SIDEBAR_USERS);
        const hasMore = users.length > MAX_SIDEBAR_USERS;

        const classColors = getChampionClassColors(p.champion.class as ChampionClass);

        return (
            <div 
                key={p.championId} 
                className={cn(
                    "flex bg-slate-900/40 rounded-2xl border transition-all duration-300 group/pick-card shadow-lg overflow-hidden",
                    isUnavailable ? "cursor-not-allowed border-red-950/40 bg-red-950/5 opacity-80" : "cursor-pointer bg-slate-900/40 backdrop-blur-md shadow-xl",
                    !isUnavailable && isSelected && "border-sky-500/60 ring-1 ring-sky-500/30 bg-sky-950/20 shadow-sky-500/10",
                    !isUnavailable && isInTeam && !isSelected && "border-emerald-500/40 bg-emerald-950/10 shadow-emerald-500/10",
                    !isUnavailable && !isSelected && !isInTeam && cn("border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-600", classColors.hoverBorder)
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    if (userChamp && !isUnavailable) handleSelectCounter(encounter.id, userChamp.id);
                }}
            >
                {/* Champion Side (Main Card) */}
                <div className="flex-1 min-w-0">
                    <div className="border-0 shadow-none ring-0 rounded-none bg-transparent">
                        <UpdatedChampionItem
                            item={userChamp ? {
                                stars: userChamp.stars,
                                rank: userChamp.rank,
                                isAwakened: userChamp.isAwakened,
                                sigLevel: userChamp.sigLevel,
                                powerRating: userChamp.powerRating,
                                champion: {
                                    id: userChamp.champion.id,
                                    name: userChamp.champion.shortName || userChamp.champion.name,
                                    championClass: userChamp.champion.class as ChampionClass,
                                    images: toChampionImages(userChamp.champion.images)
                                },
                                isAscended: userChamp.isAscended,
                                ascensionLevel: userChamp.ascensionLevel
                            } : {
                                stars: 0,
                                rank: 0,
                                champion: {
                                    id: p.championId,
                                    name: p.champion.name,
                                    championClass: p.champion.class as ChampionClass,
                                    images: toChampionImages(p.champion.images)
                                }
                            }}
                            // We handle borders/selection on the outer container
                            isSelected={false}
                            isRecommended={false}
                            isMissing={!userChamp}
                            isInTeam={false}
                            isUnavailable={false}
                        />
                    </div>
                </div>

                {/* Player Sidecar (Sidebar for Badges) */}
                <div className="w-12 shrink-0 flex flex-col items-center justify-center gap-2.5 p-1 bg-slate-950/40 border-l border-slate-800/60">
                    {users.length > 0 && (
                        <>
                            {displayUsers.map((user) => (
                                <Popover key={user.id}>
                                    <PopoverTrigger asChild>
                                        <div 
                                            className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-slate-700 hover:border-sky-500/50 transition-all cursor-pointer group/user hover:scale-110 shadow-lg"
                                            onClick={(e) => e.stopPropagation()}
                                            title={`Suggested by ${user.name} - Click to see their plan`}
                                        >
                                            {user.avatar ? (
                                                <Image src={user.avatar} alt={user.name} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                    {user.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                        className="w-[90vw] sm:w-[450px] p-0 bg-slate-950/95 border-slate-800 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden z-[100]" 
                                        align="end"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <PlayerTeamSummary 
                                            user={user} 
                                            picks={playerPicksMap[user.id]?.picks || []} 
                                            quest={quest} 
                                            scrollToEncounter={scrollToEncounter} 
                                        />
                                    </PopoverContent>
                                </Popover>
                            ))}

                            {hasMore && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <div 
                                            className="relative w-7 h-7 rounded-full bg-slate-800 border border-slate-700 hover:border-sky-500/50 transition-all cursor-pointer flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 group/more-users"
                                            onClick={(e) => e.stopPropagation()}
                                            title={`Suggested by ${users.length} players - Click to see list`}
                                        >
                                            <span className="text-[10px] font-black text-sky-400">+{users.length - MAX_SIDEBAR_USERS}</span>
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                        className="w-[280px] p-0 bg-slate-950/95 border-slate-800 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden z-[100]" 
                                        align="end"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MultiPlayerPopover 
                                            users={users} 
                                            quest={quest} 
                                            scrollToEncounter={scrollToEncounter} 
                                            playerPicksMap={playerPicksMap} 
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="relative pt-4 pb-20">
            {/* Invisible marker for scroll detection */}
            <div ref={headerRef} className="h-0 w-full" aria-hidden="true" />

            <div data-sticky-team className="sticky top-0 md:top-[68px] z-40 mb-8 -mx-4 md:mx-0 px-4 md:px-0 flex justify-center pointer-events-none">
                <motion.div 
                    layout
                    initial={false}
                    className={cn(
                        "pointer-events-auto",
                        isScrolled ? "py-2" : "py-0"
                    )}
                    animate={{
                        scale: isScrolled ? 0.98 : 1
                    }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                    <Card 
                        className={cn(
                            "bg-slate-950/90 border shadow-2xl shadow-black/60 backdrop-blur-xl transition-[background-color,border-color,opacity,box-shadow,border-radius] duration-500 ease-in-out overflow-hidden flex flex-col cursor-pointer group/team-card",
                            isScrolled ? "border-sky-500/40 rounded-3xl" : "border-sky-900/30 rounded-2xl",
                            isTeamExpanded 
                                ? "w-[95vw] sm:w-[90vw] md:max-w-5xl bg-slate-900/90" 
                                : "w-fit max-w-[calc(100vw-2rem)] hover:bg-slate-900/60 hover:border-sky-500/50"
                        )}
                        onClick={() => setIsTeamExpanded(!isTeamExpanded)}
                    >
                        <motion.div layout className="flex flex-col">
                            <div
                                className={cn(
                                    "py-2 px-4 flex items-center justify-between transition-all",
                                    isScrolled && !isTeamExpanded ? "justify-center gap-4" : ""
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-1 rounded-md bg-sky-500/10 text-sky-400 group-hover/team-card:bg-sky-500/20 transition-colors",
                                        isScrolled && !isTeamExpanded ? "hidden sm:block" : ""
                                    )}>
                                        <Users className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover/team-card:text-sky-400 transition-colors",
                                        isScrolled && !isTeamExpanded ? "hidden sm:block" : ""
                                    )}>
                                        {readOnly ? 'Team' : 'Your Team'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!readOnly && quest.status === 'VISIBLE' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleShare(); }}
                                        disabled={isSharing}
                                        className={cn(
                                            "p-1.5 rounded-lg border transition-all",
                                            shareSuccess
                                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-800 hover:bg-sky-950/30"
                                        )}
                                        title="Share your plan"
                                    >
                                        {shareSuccess ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                                    </button>
                                    )}
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 shadow-inner">
                                        <span className={cn(
                                            "text-[10px] font-black",
                                            (quest.teamLimit && selectedTeam.length > quest.teamLimit) ? "text-red-400" : "text-sky-400"
                                        )}>
                                            {selectedTeam.length}
                                        </span>
                                        {quest.teamLimit ? (
                                            <>
                                                <span className="text-[10px] text-slate-600 font-bold">/</span>
                                                <span className="text-[10px] text-slate-400 font-bold">{quest.teamLimit}</span>
                                            </>
                                        ) : (
                                            <span className="text-[10px] text-slate-600 font-bold ml-0.5">Champions</span>
                                        )}
                                    </div>
                                    <motion.div
                                        animate={{ rotate: isTeamExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                    </motion.div>
                                </div>
                            </div>

                            <AnimatePresence initial={false}>
                                {isTeamExpanded && (
                                    <motion.div
                                        key="team-expanded-content"
                                        layout
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.4, ease: "easeInOut" }}
                                        className="overflow-hidden cursor-auto"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="px-4 pb-4 pt-1 max-h-[calc(100svh-60px)] md:max-h-none overflow-y-auto custom-scrollbar"
                                            style={{ WebkitOverflowScrolling: 'touch' }}
                                        >
                                        {selectedTeam.length === 0 ? (
                                            <div className="py-8 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
                                                <div className="p-3 rounded-full bg-slate-800/50 text-slate-500">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <p className="text-sm text-slate-400 font-medium">No champions selected yet</p>
                                                <p className="text-xs text-slate-600">Assign counters to build your team</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-6">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {selectedTeam.map(r => {
                                                        const assignedEncounterIds = Object.entries(selections)
                                                            .filter(([encId, rosterId]) => rosterId === r.id)
                                                            .map(([encId]) => encId);

                                                        const assignedEncounters = quest.encounters
                                                            .filter((e: EncounterWithRelations) => assignedEncounterIds.includes(e.id))
                                                            .sort((a, b) => a.sequence - b.sequence);

                                                        const classColors = getChampionClassColors(r.champion.class);

                                                        return (
                                                            <motion.div 
                                                                layout
                                                                key={r.id} 
                                                                className={cn(
                                                                    "relative group/team-member flex flex-col bg-slate-950/40 border rounded-2xl overflow-hidden transition-all duration-300 hover:bg-slate-900/60",
                                                                    classColors.hoverBorder.replace('hover:', 'group-hover/team-member:'),
                                                                    "border-slate-800/60"
                                                                )}
                                                            >
                                                                {/* Remove Button */}
                                                                {!readOnly && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            initiateRemoveTeamMember(r.id, r.championId, r.champion.name);
                                                                        }}
                                                                        className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-slate-950/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 border border-transparent transition-all opacity-0 group-hover/team-member:opacity-100"
                                                                        title="Remove from team"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}

                                                                {/* Accent background based on class */}
                                                                <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-5 transition-opacity group-hover/team-member:opacity-10", classColors.bg)} />

                                                                <div className="p-3 flex items-start gap-3 relative z-10">
                                                                    <div className="shrink-0">
                                                                        <ChampionAvatar
                                                                            images={r.champion.images}
                                                                            name={r.champion.name}
                                                                            stars={r.stars}
                                                                            rank={r.rank}
                                                                            isAwakened={r.isAwakened}
                                                                            sigLevel={r.sigLevel}
                                                                            isAscended={r.isAscended}
                                                                            ascensionLevel={r.ascensionLevel}
                                                                            championClass={r.champion.class}
                                                                            size="lg"
                                                                            showRank={true}
                                                                            showStars={true}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 py-1 pr-6">
                                                                        <h4 className={cn("text-xs font-black uppercase tracking-wider truncate mb-0.5", classColors.text)}>
                                                                            {r.champion.name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-2">
                                                                            {assignedEncounters.length > 0 ? (
                                                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                                                    {assignedEncounters.length} {assignedEncounters.length === 1 ? 'Fight' : 'Fights'}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[10px] text-sky-500/80 font-bold uppercase tracking-widest flex items-center gap-1">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                                                                    Synergy
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-auto px-3 pb-3 relative z-10">
                                                                    {assignedEncounters.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/50 shadow-inner group-hover/team-member:border-slate-700/50 transition-colors">
                                                                            {assignedEncounters.map((enc: EncounterWithRelations) => {
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
                                                                                <motion.div
                                                                                    whileHover={{ scale: 1.05 }}
                                                                                    whileTap={{ scale: 0.95 }}
                                                                                    key={`tgt-${enc.id}`}
                                                                                    role="button"
                                                                                    tabIndex={0}
                                                                                    aria-label={`Fight ${enc.sequence}: ${enc.defender?.name || "Unknown"}`}
                                                                                    title={`Fight ${enc.sequence}: ${enc.defender?.name || "Unknown"}`}
                                                                                    className={cn(
                                                                                        "relative w-8 h-8 rounded-lg border overflow-hidden group/tgt cursor-pointer hover:border-sky-500 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                                                                                        diffBorder, diffBg
                                                                                    )}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        scrollToEncounter(enc.id);
                                                                                    }}
                                                                                >
                                                                                    {enc.defender ? (
                                                                                        <Image src={getChampionImageUrlOrPlaceholder(enc.defender.images, '64')} alt={enc.defender.name} fill className="object-cover group-hover/tgt:scale-110 transition-transform" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center bg-slate-800"><ShieldAlert className="w-3 h-3 text-slate-500" /></div>
                                                                                    )}
                                                                                    <div className="absolute inset-0 bg-sky-500/10 opacity-0 group-hover/tgt:opacity-100 transition-opacity" />
                                                                                </motion.div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-800/30 border-dashed text-center">
                                                                            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">Unassigned</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}

                                                    {/* Add Synergy Combobox Placeholder Block */}
                                                    {!readOnly && (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <button className="flex flex-col items-center justify-center gap-3 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl p-6 hover:bg-slate-900/50 hover:border-sky-500/50 transition-all group/add-synergy min-h-[160px]">
                                                                    <div className="p-3 rounded-full bg-slate-800/50 text-slate-400 group-hover/add-synergy:bg-sky-500/20 group-hover/add-synergy:text-sky-400 transition-colors shadow-inner">
                                                                        <Users className="w-6 h-6" />
                                                                    </div>
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover/add-synergy:text-sky-400 transition-colors">Add Synergy</span>
                                                                        <span className="text-[10px] text-slate-500 font-medium">Search roster...</span>
                                                                    </div>
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent 
                                                                className="w-[calc(100vw-32px)] sm:w-[320px] p-0 bg-slate-950/95 border border-slate-700/80 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(14,165,233,0.15)] backdrop-blur-xl rounded-xl overflow-hidden z-[100]" 
                                                                align="start"
                                                                sideOffset={8}
                                                            >
                                                                <Command className="bg-transparent" filter={(value, search) => {
                                                                    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                                                                    return 0;
                                                                }}>
                                                                    <CommandInput placeholder="Search champions..." className="h-11" />
                                                                    <CommandEmpty className="py-4 text-center text-sm text-slate-500">No champions found.</CommandEmpty>
                                                                    <CommandList className="max-h-[300px] custom-scrollbar">
                                                                        <CommandGroup>
                                                                            {/* Only show unique champions from roster that meet quest requirements */}
                                                                            {roster.filter((r, i, self) => self.findIndex(t => t.championId === r.championId) === i).filter(r => isChampionValidForEncounterOrQuest(r, quest, undefined)).map((r) => {
                                                                                const isAssigned = Object.values(selections).some(rid => {
                                                                                    if (!rid) return false;
                                                                                    return roster.find(re => re.id === rid)?.championId === r.championId;
                                                                                });
                                                                                const isSynergy = synergyIds.includes(r.championId);
                                                                                const isSelected = isAssigned || isSynergy;

                                                                                return (
                                                                                    <CommandItem
                                                                                        key={r.championId}
                                                                                        value={`${r.champion.name} ${r.champion.shortName || ''}`}
                                                                                        className="flex items-center gap-3 px-3 py-2 cursor-pointer aria-selected:bg-slate-800/60"
                                                                                        onSelect={() => {
                                                                                            if (!isAssigned) handleSelectSynergy(r.championId);
                                                                                        }}
                                                                                        disabled={isAssigned}
                                                                                    >
                                                                                        <div className={cn(
                                                                                            "relative w-8 h-8 rounded-lg overflow-hidden border border-slate-700 shrink-0",
                                                                                            isAssigned && "opacity-40 grayscale"
                                                                                        )}>
                                                                                            <Image 
                                                                                                src={getChampionImageUrlOrPlaceholder(r.champion.images, "64")} 
                                                                                                alt={r.champion.name} 
                                                                                                fill 
                                                                                                className="object-cover"
                                                                                            />
                                                                                        </div>
                                                                                        <span className={cn(
                                                                                            "text-sm font-bold truncate flex-1",
                                                                                            isAssigned ? "text-slate-600" : "text-slate-200"
                                                                                        )}>
                                                                                            {r.champion.name}
                                                                                        </span>
                                                                                        {isSelected && !isAssigned && (
                                                                                            <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
                                                                                        )}
                                                                                        {isAssigned && (
                                                                                            <Target className="w-4 h-4 text-slate-600 shrink-0" />
                                                                                        )}
                                                                                    </CommandItem>
                                                                                );
                                                                            })}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    )}
                                                </div>

                                                {quest.teamLimit !== null && selectedTeam.length > quest.teamLimit && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 bg-red-950/20 border border-red-900/40 rounded-xl text-red-400 shadow-lg shadow-red-900/10"
                                                    >
                                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                                        <p className="text-xs font-bold uppercase tracking-wider">Team limit exceeded by {selectedTeam.length - quest.teamLimit} champions</p>
                                                    </motion.div>
                                                )}
                                            </div>
                                        )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Compact View when collapsed */}
                            <AnimatePresence>
                                {!isTeamExpanded && selectedTeam.length > 0 && (
                                    <motion.div
                                        key="team-collapsed-content"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="px-4 pb-3 flex flex-row gap-3 justify-center items-center"
                                    >
                                        <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300">
                                            {selectedTeam.map(r => (
                                                <div key={`collapsed-${r.id}`} className="relative group/mini-avatar">
                                                    <div className="relative w-8 h-8 rounded-full border-2 border-slate-950 overflow-hidden shadow-lg transition-transform group-hover/mini-avatar:-translate-y-1">
                                                        <Image src={getChampionImageUrlOrPlaceholder(r.champion.images, '64')} alt={r.champion.name} fill className="object-cover" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {selectedTeam.length > 0 && (
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">
                                                Active Team
                                            </span>
                                        )}
                                    </motion.div>
                                )}
                                {!isTeamExpanded && selectedTeam.length === 0 && (
                                    <motion.div
                                        key="team-empty-collapsed"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="px-4 pb-2 text-center"
                                    >
                                        <p className="text-[9px] text-slate-600 uppercase tracking-tighter font-bold">Click to expand</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </Card>
                </motion.div>
            </div>

            <div className="relative pl-3 md:pl-10 pb-20">
                {/* Continuous Vertical Timeline Line */}
                <style>{`
                    @keyframes tlFlow1 {
                        0%   { transform: translateY(-100%); opacity: 0; }
                        8%   { opacity: 1; }
                        88%  { opacity: 0.7; }
                        100% { transform: translateY(300%); opacity: 0; }
                    }
                    @keyframes tlFlow2 {
                        0%   { transform: translateY(-100%); opacity: 0; }
                        8%   { opacity: 0.5; }
                        88%  { opacity: 0.3; }
                        100% { transform: translateY(400%); opacity: 0; }
                    }
                    @keyframes tlPulse {
                        0%, 100% { opacity: 0.15; }
                        50%      { opacity: 0.35; }
                    }
                    @keyframes tlRing1 {
                        0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.8; }
                        100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
                    }
                    @keyframes tlRing2 {
                        0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.5; }
                        100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
                    }
                    @keyframes tlRing3 {
                        0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.3; }
                        100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; }
                    }
                    @keyframes tlCorePulse {
                        0%, 100% { box-shadow: 0 0 4px 1px rgba(56,189,248,0.6), 0 0 10px 2px rgba(56,189,248,0.2); }
                        50%      { box-shadow: 0 0 8px 2px rgba(56,189,248,0.9), 0 0 20px 4px rgba(56,189,248,0.35); }
                    }
                    @keyframes tlTick {
                        0%, 100% { opacity: 0.25; }
                        50%      { opacity: 0.7; }
                    }
                `}</style>

                <div className="absolute top-0 bottom-[120px] left-3 md:left-10 -translate-x-1/2 z-0" style={{ width: '3px' }}>
                    {/* Base track */}
                    <div className="absolute inset-0 rounded-full bg-slate-800/70" />
                    {/* Fade-in mask at the top so the line visually starts at the origin node */}
                    <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950 to-transparent z-10 pointer-events-none" />
                    {/* Breathing ambient glow */}
                    <div
                        className="absolute -inset-x-1 inset-y-0 rounded-full bg-sky-500/10 blur-[3px]"
                        style={{ animation: 'tlPulse 3s ease-in-out infinite' }}
                    />
                    {/* Primary energy bolt */}
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                        <div
                            className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-transparent via-sky-400 to-transparent"
                            style={{ height: '32%', animation: 'tlFlow1 2.6s ease-in-out infinite' }}
                        />
                        <div
                            className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-transparent via-indigo-400/70 to-transparent"
                            style={{ height: '22%', animation: 'tlFlow2 2.6s ease-in-out infinite 1.3s' }}
                        />
                    </div>
                    {/* Wide soft glow that travels with the primary bolt */}
                    <div className="absolute overflow-hidden rounded-full" style={{ inset: '0 -4px' }}>
                        <div
                            className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-transparent via-sky-500/20 to-transparent blur-[4px]"
                            style={{ height: '32%', animation: 'tlFlow1 2.6s ease-in-out infinite' }}
                        />
                    </div>
                </div>

                {quest.encounters.length === 0 ? (
                    <p className="text-center text-slate-400 italic mt-8">No encounters have been added to this quest yet.</p>
                ) : (
                    <div className="space-y-6">
                        {/* Column Header */}
                        <div className="relative mb-8">
                            {/* Origin node — same absolute positioning as encounter nodes */}
                            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                {[0, 0.8, 1.6].map((delay, i) => (
                                    <div
                                        key={i}
                                        className="absolute rounded-full border border-sky-400/50"
                                        style={{
                                            width: '18px', height: '18px',
                                            top: '50%', left: '50%',
                                            animation: `tlRing${i + 1} 2.4s ease-out infinite`,
                                            animationDelay: `${delay}s`,
                                        }}
                                    />
                                ))}
                                {[-35, 0, 35].map((deg, i) => (
                                    <div
                                        key={`tick-${i}`}
                                        className="absolute bg-sky-400/50 rounded-full"
                                        style={{
                                            width: '1.5px', height: '7px',
                                            bottom: '50%', left: 'calc(50% - 0.75px)',
                                            transformOrigin: 'bottom center',
                                            transform: `rotate(${deg}deg) translateY(12px)`,
                                            animation: `tlTick 2.4s ease-in-out infinite`,
                                            animationDelay: `${i * 0.15}s`,
                                        }}
                                    />
                                ))}
                                <div
                                    className="relative w-2.5 h-2.5 rounded-full bg-sky-400 z-10"
                                    style={{ animation: 'tlCorePulse 2.4s ease-in-out infinite' }}
                                />
                            </div>
                            {/* Header box — ml-5 md:ml-10 matches encounter card pl-5 md:pl-10 exactly */}
                            <div className="ml-5 md:ml-10 flex items-center py-3 bg-slate-950/40 border border-slate-800/50 rounded-xl px-2 md:px-4">
                            <div className="flex-1 flex items-center justify-start px-2 md:px-6 gap-2 md:gap-3">
                                <div className="relative shrink-0">
                                    <div className="absolute -inset-1 bg-red-500/20 blur-sm rounded-full" />
                                    <Target className="relative w-3.5 h-3.5 md:w-4 md:h-4 text-red-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-500 truncate">
                                        Target
                                    </span>
                                    <div className="h-0.5 w-8 md:w-12 bg-gradient-to-r from-red-500/50 to-transparent rounded-full mt-0.5" />
                                </div>
                            </div>

                            <div className="w-12 md:w-24 shrink-0 flex items-center justify-center">
                                <div className="relative flex items-center justify-center w-6 h-6 md:w-8 md:h-8">
                                     <div className="absolute inset-0 border border-slate-800 rotate-45 rounded-sm" />
                                     <span className="relative z-10 text-[8px] md:text-[10px] font-black text-slate-600 uppercase italic">VS</span>
                                </div>
                            </div>

                            <div className="flex-1 flex items-center justify-end px-2 md:px-6 gap-2 md:gap-3 text-right">
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-l from-sky-400 to-indigo-500 truncate">
                                        Counter
                                    </span>
                                    <div className="h-0.5 w-8 md:w-12 bg-gradient-to-l from-sky-500/50 to-transparent rounded-full mt-0.5" />
                                </div>
                                <div className="relative shrink-0">
                                    <div className="absolute -inset-1 bg-sky-500/20 blur-sm rounded-full" />
                                    <Swords className="relative w-3.5 h-3.5 md:w-4 md:h-4 text-sky-500" />
                                </div>
                            </div>
                            </div> {/* end header box */}
                        </div> {/* end column header */}

                        {/* Difficulty Filter Bar */}
                        <div className="flex items-center flex-wrap justify-between gap-x-2 gap-y-1.5 pl-6 md:pl-10 -mt-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 shrink-0">Difficulty</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {(["HARD", "NORMAL", "EASY"] as const).map(d => {
                                    const isActive = difficultyFilter.includes(d);
                                    const label = d === "HARD" ? "Hard" : d === "NORMAL" ? "Normal" : "Easy";
                                    const activeClass = d === "HARD"
                                        ? "bg-red-950/60 border-red-500/50 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                                        : d === "NORMAL"
                                            ? "bg-amber-950/60 border-amber-500/50 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                                            : "bg-emerald-950/60 border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.12)]";
                                    const inactiveClass = "bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400";
                                    return (
                                        <button
                                            key={d}
                                            onClick={() => toggleDifficultyFilter(d)}
                                            className={cn(
                                                "px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-200",
                                                isActive ? activeClass : inactiveClass
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                                {difficultyFilter.length > 0 && (
                                    <button
                                        onClick={() => setDifficultyFilter([])}
                                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-slate-800 bg-slate-900/60 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-slate-300 hover:border-slate-700 transition-all duration-200"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                        All
                                    </button>
                                )}
                            </div>
                            {difficultyFilter.length > 0 && (
                                <span className="text-[9px] text-slate-600 ml-1">
                                    {filteredEncounters.length}/{quest.encounters.length} fights
                                </span>
                            )}
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={() => setIsClearPlanOpen(true)}
                                    title="Clear all counter selections"
                                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-slate-800 bg-slate-900/60 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-400 transition-all duration-200 shrink-0"
                                >
                                    <Trash2 className="w-2.5 h-2.5" />
                                    <span className="hidden sm:inline">Clear Plan</span>
                                </button>
                            )}
                        </div>

                        {filteredEncounters.length === 0 ? (
                            <p className="text-center text-slate-500 italic mt-8 pl-6 md:pl-10 text-sm">No {difficultyFilter.map(d => d.toLowerCase()).join(" or ")} fights in this quest.</p>
                        ) : filteredEncounters.map((encounter: EncounterWithRelations) => {
                            const originalIndex = quest.encounters.findIndex(e => e.id === encounter.id);
                            return (
                            <EncounterCard
                                key={encounter.id}
                                encounter={encounter}
                                index={originalIndex}
                                quest={quest}
                                expandedId={expandedId}
                                toggleExpand={toggleExpand}
                                selections={selections}
                                readOnly={readOnly}
                                showVideoId={showVideoId}
                                setShowVideoId={setShowVideoId}
                                tabState={{
                                    encounterTabs,
                                    setEncounterTabs,
                                    featuredPicks,
                                    alliancePicks,
                                    popularCounters
                                }}
                                filterState={{
                                    searchQuery,
                                    setSearchQuery,
                                    showAdvancedFilters,
                                    setShowAdvancedFilters,
                                    activeFiltersCount,
                                    filterMetadata,
                                    tagFilter,
                                    setTagFilter,
                                    tagLogic,
                                    setTagLogic,
                                    abilityCategoryFilter,
                                    setAbilityCategoryFilter,
                                    abilityCategoryLogic,
                                    setAbilityCategoryLogic,
                                    abilityFilter,
                                    setAbilityFilter,
                                    abilityLogic,
                                    setAbilityLogic,
                                    immunityFilter,
                                    setImmunityFilter,
                                    immunityLogic,
                                    setImmunityLogic,
                                    clearAllFilters,
                                    CLASSES,
                                    selectedClass,
                                    setSelectedClass
                                }}
                                rosterState={{
                                    roster,
                                    filteredGlobalRoster,
                                    selectedTeam,
                                    synergyIds,
                                    isRosterExpanded,
                                    setIsRosterExpanded,
                                    resolveRosterItem,
                                    handleSelectCounter
                                }}
                                isNodesCollapsed={isNodesCollapsed}
                                setIsNodesCollapsed={setIsNodesCollapsed}
                                renderChampionItem={renderChampionItem}
                                renderListPick={renderListPick}
                            />
                        ); })}
                    </div>
                )}
            </div>

            <AlertDialog open={isClearPlanOpen} onOpenChange={setIsClearPlanOpen}>
                <AlertDialogContent className="bg-slate-950 border-slate-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Clear entire plan?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            This will remove all counter selections for every fight in this quest. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeClearPlan}
                            className="bg-red-600 text-white hover:bg-red-500"
                        >
                            Clear Plan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!championToRemove} onOpenChange={(open) => !open && setChampionToRemove(null)}>
                <AlertDialogContent className="bg-slate-950 border-slate-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Remove {championToRemove?.championName}?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            This champion is currently assigned to <strong className="text-white">{championToRemove?.assignedEncounters.length}</strong> fights. 
                            Removing them will clear all of these assignments. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={executeRemoveTeamMember}
                            className="bg-red-600 text-white hover:bg-red-500"
                        >
                            Remove Assignments
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
