"use client";
import { EncounterCard } from "./encounter-card/EncounterCard";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Search, X, Trash2, Crosshair, Youtube, Users, Share2, Check, Target, Swords, Ban, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getShareablePlanId, savePlayerQuestCounter } from "@/app/actions/quests";
import type { PickCounterWithChampion } from "@/app/actions/quests";
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
    toChampionImages
} from "./types";
import {
    isChampionValidForEncounterOrQuest,
    getValidRosterCountForChampion
} from "./utils";

import type { ChampionClass } from "@prisma/client";
import type { Champion } from "@/types/champion";

const CLASSES = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"] as const;

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

export default function QuestTimelineClient({ quest, roster = [], savedEncounters = [], popularCounters = {}, featuredPicks = {}, alliancePicks = {}, filterMetadata = { tags: [], abilityCategories: [], abilities: [], immunities: [] }, readOnly = false, rosterMap = {}, initialSelections }: QuestTimelineProps) {
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

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
        // Reset video state when switching/closing
        if (expandedId !== id) setShowVideoId(null);
    };

    const scrollToEncounter = (id: string) => {
        // Expand the card first
        setExpandedId(id);
        setIsTeamExpanded(false); // Optionally collapse team view to see the card better
        
        // Wait a small bit for the previous card to start collapsing and the new one to expand
        // This prevents scrolling to the wrong position due to layout shifts
        setTimeout(() => {
            const element = document.getElementById(`encounter-${id}`);
            if (element) {
                // Find the header to account for its height (sticky)
                const stickyHeader = document.querySelector('.sticky.top-\\[68px\\]');
                const headerHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height + 68 : 140; 
                
                const rect = element.getBoundingClientRect();
                const offsetPosition = rect.top + window.scrollY - headerHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        }, 100);
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
                // Check if the CHAMPION is already in the team
                const isChampInTeam = Object.values(selections).some(rid => {
                    if (!rid) return false;
                    return roster.find(r => r.id === rid)?.championId === championId;
                });

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
        
        Object.entries(selections).forEach(([encId, rosterId]) => {
            if (rosterId !== null) {
                const r = resolveRosterItem(rosterId, encId);
                if (r) {
                    // Use rosterId as key to ensure each unique rarity is counted once
                    teamMap.set(rosterId, r);
                }
            }
        });
        
        return Array.from(teamMap.values());
    }, [selections, resolveRosterItem]);

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
                            isAscended: userChamp.isAscended
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
        const isMissing = !userChamp;
        const isInTeam = Object.values(selections).some(rid => rid !== null && roster.find(r => r.id === rid)?.championId === p.championId);

        const isUnavailable = isChampionUnavailableForEncounter({
            userChamp,
            encounterId: encounter.id,
            selections,
            roster,
            quest,
            encounter
        });

        const classColors = getChampionClassColors(p.champion.class as ChampionClass);

        return (
            <div 
                key={p.championId} 
                className={cn(
                    "flex flex-col rounded-2xl transition-all duration-300 border relative overflow-hidden group/pick-card",
                    isUnavailable ? "cursor-not-allowed border-red-950/40 bg-red-950/5 opacity-80" : "cursor-pointer bg-slate-900/40 backdrop-blur-md hover:scale-[1.02] shadow-xl",
                    !isUnavailable && isSelected && "border-sky-500/60 ring-1 ring-sky-500/30 bg-sky-950/20 shadow-sky-500/10",
                    !isUnavailable && isInTeam && !isSelected && "border-emerald-500/40 bg-emerald-950/10 shadow-emerald-500/10",
                    !isUnavailable && isMissing && "opacity-70 grayscale-[0.5] hover:grayscale-0 border-slate-800/50",
                    !isUnavailable && !isSelected && !isInTeam && !isMissing && cn("border-slate-800/80 hover:bg-slate-800/40", classColors.hoverBorder)
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    if (userChamp && !isUnavailable) handleSelectCounter(encounter.id, userChamp.id);
                }}
            >
                {/* Subtle Class Ambient Glow */}
                <div className={cn("absolute -inset-1 opacity-[0.03] transition-opacity group-hover/pick-card:opacity-[0.07] pointer-events-none blur-3xl", classColors.bg)} />
                
                <div className="flex p-3 gap-4 items-start relative z-10">
                    <div className="shrink-0 relative">
                        <ChampionAvatar
                            images={toChampionImages(p.champion.images)}
                            name={p.champion.name}
                            stars={userChamp?.stars || 0}
                            rank={userChamp?.rank || 0}
                            isAwakened={userChamp?.isAwakened || false}
                            sigLevel={userChamp?.sigLevel || 0}
                            championClass={p.champion.class}
                            size="lg"
                            showRank={true}
                            showStars={true}
                            className="rounded-xl border-slate-800/50 shadow-lg"
                        />

                        {/* Status Checkmark */}
                        {isSelected && (
                            <div className="absolute -top-1.5 -left-1.5 p-1.5 bg-sky-500 text-slate-950 rounded-full shadow-lg z-20 border border-sky-400/50 animate-in zoom-in duration-300">
                                <Check className="w-3.5 h-3.5 stroke-[4]" />
                            </div>
                        )}
                        {isInTeam && !isSelected && !isUnavailable && (
                            <div className="absolute -top-1.5 -left-1.5 p-1.5 bg-emerald-600 text-white rounded-full shadow-lg z-20 border border-emerald-400/50 animate-in zoom-in duration-300">
                                <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0 py-0.5 space-y-2">
                        <div className="flex flex-col">
                            <h5 className={cn(
                                "text-base font-black truncate tracking-tight transition-all",
                                classColors.text,
                                "group-hover/pick-card:brightness-125 hover:scale-[1.01] origin-left"
                            )}>
                                {p.champion.name}
                            </h5>
                            <div className="flex items-center gap-2 mt-1">
                                {isMissing && (
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-800/50">Missing</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attribution Bar */}
                {p.pickedBy && p.pickedBy.length > 0 && (
                    <div className="mt-auto px-3 py-2 bg-slate-950/40 border-t border-slate-800/50 flex flex-wrap gap-2 items-center relative z-10 transition-colors group-hover/pick-card:bg-slate-950/60">
                        {p.pickedBy.map((user) => (
                            <div 
                                key={user.id} 
                                className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/50 rounded-full pl-0.5 pr-2 py-0.5 group/user hover:border-sky-500/50 transition-all shadow-sm"
                                title={`Suggested by ${user.name}`}
                            >
                                <div className="relative w-4 h-4 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                                    {user.avatar ? (
                                        <Image src={user.avatar} alt={user.name} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-slate-400">
                                            {user.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[9px] text-slate-300 font-bold truncate max-w-[90px]">
                                    {user.name}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {isUnavailable && (
                    <div className="absolute inset-0 z-40 bg-red-950/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <div className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full flex items-center gap-2 shadow-xl">
                            <Ban className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Unavailable</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative pt-4 pb-20">
            {/* Invisible marker for scroll detection */}
            <div ref={headerRef} className="h-0 w-full" aria-hidden="true" />

            <div className="sticky top-[68px] z-40 mb-8 -mx-4 md:mx-0 px-4 md:px-0 flex justify-center pointer-events-none">
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
                                        className="overflow-hidden px-4 pb-4"
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
                                                                            championClass={r.champion.class}
                                                                            size="lg"
                                                                            showRank={true}
                                                                            showStars={true}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 py-1">
                                                                        <h4 className={cn("text-xs font-black uppercase tracking-wider truncate mb-0.5", classColors.text)}>
                                                                            {r.champion.name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                                                {assignedEncounters.length} {assignedEncounters.length === 1 ? 'Fight' : 'Fights'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-auto px-3 pb-3 relative z-10">
                                                                    {assignedEncounters.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/50 shadow-inner group-hover/team-member:border-slate-700/50 transition-colors">
                                                                            {assignedEncounters.map((enc: EncounterWithRelations) => (
                                                                                <motion.div 
                                                                                    whileHover={{ scale: 1.05 }}
                                                                                    whileTap={{ scale: 0.95 }}
                                                                                    key={`tgt-${enc.id}`} 
                                                                                    role="button"
                                                                                    tabIndex={0}
                                                                                    aria-label={`Fight: ${enc.defender?.name || "Unknown"}`}
                                                                                    title={`Fight: ${enc.defender?.name || "Unknown"}`} 
                                                                                    className="relative w-8 h-8 rounded-lg border border-slate-700 overflow-hidden group/tgt cursor-pointer hover:border-sky-500 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
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
                                                                            ))}
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
                                        )}                                    </motion.div>
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

            <div className="relative pl-6 md:pl-10 pb-20">
                {/* Continuous Vertical Timeline Line */}
                <div className="absolute top-14 bottom-[120px] left-6 md:left-10 w-1 bg-slate-800 -translate-x-1/2 z-0 shadow-inner rounded-full">
                    <div className="w-full h-full bg-gradient-to-b from-slate-800 via-sky-900/20 to-slate-800 rounded-full" />
                </div>

                {quest.encounters.length === 0 ? (
                    <p className="text-center text-slate-400 italic mt-8">No encounters have been added to this quest yet.</p>
                ) : (
                    <div className="space-y-6">
                        {/* Column Header */}
                        <div className="flex items-center pl-8 md:pl-10 mb-8 py-3 bg-slate-950/40 border-y border-slate-800/50 -mx-4 px-2 md:px-4 rounded-xl">
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
                        </div>

                        {quest.encounters.map((encounter: EncounterWithRelations, index: number) => (
                            <EncounterCard
                                key={encounter.id}
                                encounter={encounter}
                                index={index}
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
                                    isRosterExpanded,
                                    setIsRosterExpanded,
                                    resolveRosterItem,
                                    handleSelectCounter
                                }}
                                renderChampionItem={renderChampionItem}
                                renderListPick={renderListPick}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
