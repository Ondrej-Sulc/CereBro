"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { QuestPlan, QuestEncounter, Champion as PrismaChampion, Roster, PlayerQuestEncounter, Tag, QuestEncounterNode, NodeModifier, ChampionClass, Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, CheckCircle2, ShieldAlert, AlertCircle, Info, Search, X, Zap, Shield, BookOpen, Tag as TagIcon, Filter, Trash2, Crosshair, Youtube, PlayCircle, Users, Share2, Check } from "lucide-react";
import { savePlayerQuestCounter, getShareablePlanId } from "@/app/actions/quests";
import { getChampionImageUrl, getStarBorderClass, getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionAvatar } from "@/components/champion-avatar";
import { UpdatedChampionItem } from "@/components/UpdatedChampionItem";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { cn } from "@/lib/utils";
import { ChampionImages, Champion } from "@/types/champion";
import { MultiSelectFilter } from "@/components/ui/filters";
import { useToast } from "@/hooks/use-toast";
import { getQuestPlanById } from "@/app/actions/quests";

export type QuestWithRelations = NonNullable<Prisma.PromiseReturnType<typeof getQuestPlanById>>;
export type EncounterWithRelations = QuestWithRelations["encounters"][0];
export type EncounterNodeWithRelations = EncounterWithRelations["nodes"][0];

export type RosterWithChampion = Roster & {
    champion: Champion;
};

interface FilterMetadata {
    tags: { id: string | number, name: string }[];
    abilityCategories: { id: string | number, name: string }[];
    abilities: { id: string | number, name: string }[];
    immunities: { id: string | number, name: string }[];
}

interface Props {
    quest: QuestWithRelations;
    roster?: RosterWithChampion[];
    savedEncounters?: PlayerQuestEncounter[];
    filterMetadata?: FilterMetadata;
    readOnly?: boolean;
    /** Map of questEncounterId -> roster entry, used in readOnly mode to resolve selected champion details */
    rosterMap?: Record<string, any>;
    /** Pre-built selections map (encounterId -> championId), used in readOnly mode */
    initialSelections?: Record<string, number | null>;
}

const CLASSES = Object.values(ChampionClass);

function getYoutubeId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function toChampionImages(images: unknown): ChampionImages {
    if (!images || typeof images !== "object") {
        return {
            hero: "",
            full_primary: "",
            full_secondary: "",
            p_32: "",
            s_32: "",
            p_64: "",
            s_64: "",
            p_128: "",
            s_128: "",
        };
    }
    const imgObj = images as Record<string, unknown>;
    return {
        hero: typeof imgObj.hero === "string" ? imgObj.hero : "",
        full_primary: typeof imgObj.full_primary === "string" ? imgObj.full_primary : "",
        full_secondary: typeof imgObj.full_secondary === "string" ? imgObj.full_secondary : "",
        p_32: typeof imgObj.p_32 === "string" ? imgObj.p_32 : "",
        s_32: typeof imgObj.s_32 === "string" ? imgObj.s_32 : "",
        p_64: typeof imgObj.p_64 === "string" ? imgObj.p_64 : "",
        s_64: typeof imgObj.s_64 === "string" ? imgObj.s_64 : "",
        p_128: typeof imgObj.p_128 === "string" ? imgObj.p_128 : "",
        s_128: typeof imgObj.s_128 === "string" ? imgObj.s_128 : "",
    };
}

export default function QuestTimelineClient({ quest, roster = [], savedEncounters = [], filterMetadata = { tags: [], abilityCategories: [], abilities: [], immunities: [] }, readOnly = false, rosterMap = {}, initialSelections }: Props) {
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
    const [selections, setSelections] = useState<Record<string, number | null>>(() => {
        if (initialSelections) return initialSelections;
        const initial: Record<string, number | null> = {};
        savedEncounters.forEach(se => {
            initial[se.questEncounterId] = se.selectedChampionId;
        });
        return initial;
    });

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
        // Reset video state when switching/closing
        if (expandedId !== id) setShowVideoId(null);
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

    const handleSelectCounter = async (encounterId: string, championId: number) => {
        const previousValue = selections[encounterId];

        // If selecting a NEW champion (not unselecting, and not already selected for this fight)
        if (previousValue !== championId) {
            // Check if this champion is already in the team for another fight
            const isAlreadyInTeam = Object.values(selections).includes(championId);

            // If they aren't in the team, and adding them would exceed the limit, block it
            if (!isAlreadyInTeam && quest.teamLimit !== null && selectedTeam.length >= quest.teamLimit) {
                toast({
                    title: "Team Limit Reached",
                    description: `You can only select up to ${quest.teamLimit} champions for this quest.`,
                    variant: "destructive"
                });
                return; // Stop here, do not select
            }
        }

        const newValue = previousValue === championId ? null : championId;
        setSelections(prev => ({ ...prev, [encounterId]: newValue }));

        try {
            await savePlayerQuestCounter(quest.id, encounterId, newValue);
        } catch (error) {
            console.error("Failed to save counter selection", error);
            setSelections(prev => ({ ...prev, [encounterId]: previousValue }));
            toast({ title: "Error", description: "Failed to save selection.", variant: "destructive" });
        }
    };

    /** Resolve a roster item for a given champion ID — works for both interactive and readOnly modes */
    const resolveRosterItem = (championId: number, encounterId: string): RosterWithChampion | undefined => {
        if (readOnly) {
            return rosterMap[encounterId];
        }
        return roster.find(r => r.championId === championId);
    };

    const selectedTeam = useMemo(() => {
        const teamMap = new Map<string, RosterWithChampion>();
        
        Object.entries(selections).forEach(([encId, champId]) => {
            if (champId !== null) {
                const r = resolveRosterItem(champId, encId);
                if (r) {
                    teamMap.set(r.id, r);
                }
            }
        });
        
        return Array.from(teamMap.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selections, roster, rosterMap, readOnly]);

    return (
        <div className="relative pt-4 pb-20">
            {/* Invisible marker for scroll detection */}
            <div ref={headerRef} className="h-0 w-full" aria-hidden="true" />

            <div className="sticky top-[68px] z-40 mb-8 -mx-4 md:mx-0 px-4 md:px-0 flex justify-center pointer-events-none">
                <div className={cn(
                    "transition-all duration-500 ease-in-out pointer-events-auto",
                    isScrolled ? "scale-[0.98] py-2" : "scale-100 py-0"
                )}>
                    <Card className={cn(
                        "bg-slate-950/90 border shadow-2xl shadow-black/60 backdrop-blur-xl transition-all duration-500 ease-in-out overflow-hidden flex flex-col",
                        isScrolled ? "border-sky-500/40 rounded-3xl" : "border-sky-900/30 rounded-2xl",
                        isTeamExpanded ? "w-[95vw] sm:w-[90vw] md:max-w-5xl" : "w-fit min-w-[200px]"
                    )}>
                        <div
                            className={cn(
                                "py-2 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/40 transition-all group/team-header",
                                isScrolled && !isTeamExpanded ? "justify-center gap-4" : ""
                            )}
                            onClick={() => setIsTeamExpanded(!isTeamExpanded)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-1 rounded-md bg-sky-500/10 text-sky-400 group-hover/team-header:bg-sky-500/20 transition-colors",
                                    isScrolled && !isTeamExpanded ? "hidden sm:block" : ""
                                )}>
                                    <Users className="w-3.5 h-3.5" />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover/team-header:text-sky-400 transition-colors",
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
                                        <div className={cn(
                                            "transition-transform duration-300",
                                            isTeamExpanded ? "rotate-180" : ""
                                        )}>
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                        </div>
                                    </div>
                                </div>

                                <div className={cn(
                                    "transition-all duration-500 ease-in-out overflow-hidden px-4 pb-4",
                                    isTeamExpanded ? "max-h-[800px] opacity-100" : "max-h-[140px] opacity-90"
                                )}>
                                    {selectedTeam.length === 0 ? (
                                        <div className="py-4 flex flex-col items-center justify-center gap-1">
                                            <p className="text-[10px] text-slate-500 italic font-medium">No champions selected.</p>
                                            {!isTeamExpanded && <p className="text-[8px] text-slate-600 uppercase tracking-tighter">Click to expand</p>}
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            "flex items-end transition-all duration-500",
                                            isTeamExpanded ? "flex-col gap-4" : "flex-row gap-3 justify-center"
                                        )}>
                                            <div className={cn(
                                                "flex gap-3 pb-1 overflow-x-auto custom-scrollbar scroll-smooth",
                                                isTeamExpanded ? "w-full justify-start" : "w-fit max-w-full"
                                            )}>
                                                {selectedTeam.map(r => {
                                                    const assignedEncounterIds = Object.entries(selections)
                                                        .filter(([encId, champId]) => champId === r.championId && resolveRosterItem(champId, encId)?.id === r.id)
                                                        .map(([encId]) => encId);

                                                    const assignedEncounters = quest.encounters.filter((e: EncounterWithRelations) => assignedEncounterIds.includes(e.id));

                                                    // Dynamic sizes based on expansion AND scroll state
                                                    const avatarSize = isTeamExpanded
                                                        ? (isScrolled ? "lg" : "xl")
                                                        : (isScrolled ? "md" : "lg");

                                                    const containerWidth = isTeamExpanded
                                                        ? (isScrolled ? "w-[75px] sm:w-[85px]" : "w-[85px] sm:w-[95px]")
                                                        : (isScrolled ? "w-[50px] sm:w-[60px]" : "w-[75px] sm:w-[85px]");

                                                    return (
                                                        <div key={r.id} className={cn(
                                                            "shrink-0 flex flex-col gap-2 transition-all duration-300",
                                                            containerWidth
                                                        )}>
                                                            <ChampionAvatar
                                                                images={r.champion.images}
                                                                name={r.champion.name}
                                                                stars={r.stars}
                                                                rank={r.rank}
                                                                isAwakened={r.isAwakened}
                                                                sigLevel={r.sigLevel}
                                                                championClass={r.champion.class}
                                                                size={avatarSize}
                                                                showRank={isTeamExpanded}
                                                                showStars={isTeamExpanded}
                                                            />

                                                            {isTeamExpanded && assignedEncounters.length > 0 && (
                                                                <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-1.5 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-300">
                                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                                        {assignedEncounters.map((enc: EncounterWithRelations) => (
                                                                            <div key={`tgt-${enc.id}`} title={`Fight ${enc.sequence}: ${enc.defender?.name || "Unknown"}`} className="relative w-6 h-6 rounded-md border border-slate-700 overflow-hidden group/tgt cursor-help shadow-sm">
                                                                                {enc.defender ? (
                                                                                    <Image src={getChampionImageUrlOrPlaceholder(enc.defender.images, '64')} alt={enc.defender.name} fill className="object-cover group-hover:scale-110 transition-transform" />
                                                                                ) : (
                                                                                    <div className="w-full h-full flex items-center justify-center bg-slate-800"><ShieldAlert className="w-3 h-3 text-slate-500" /></div>
                                                                                )}
                                                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <span className="text-[9px] font-black text-white">{enc.sequence}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {isTeamExpanded && quest.teamLimit !== null && selectedTeam.length > quest.teamLimit && (
                                                <div className="w-full flex items-center gap-3 px-4 py-2.5 bg-red-950/20 border border-red-900/40 rounded-xl text-red-400 animate-in slide-in-from-bottom-2">
                                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                                    <p className="text-xs font-bold uppercase tracking-wider">Team limit exceeded by {selectedTeam.length - quest.teamLimit} champions</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div>

            <div className="relative pl-6 md:pl-10 pb-8">
                {/* Continuous Vertical Timeline Line */}
                <div className="absolute top-8 bottom-12 left-6 md:left-10 w-1 bg-slate-800 -translate-x-1/2 z-0 shadow-inner rounded-full">
                    {/* Progress Fill (Optional later, currently static styling) */}
                    <div className="w-full h-full bg-gradient-to-b from-slate-800 via-sky-900/20 to-slate-800 rounded-full" />
                </div>

                {quest.encounters.length === 0 ? (
                    <p className="text-center text-slate-400 italic mt-8">No encounters have been added to this quest yet.</p>
                ) : (
                    <div className="space-y-6">
                        {/* Start Node */}
                        <div className="relative flex items-center h-12 pl-8 md:pl-10 group">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-slate-950 bg-slate-800 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                                </div>
                            </div>
                            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Quest Start</div>
                        </div>

                        {quest.encounters.map((encounter: EncounterWithRelations, index: number) => {
                            const isExpanded = expandedId === encounter.id;
                            const selectedChampId = selections[encounter.id];
                            const selectedRosterItem = selectedChampId ? resolveRosterItem(selectedChampId, encounter.id) ?? null : null;
                            const hasSelection = !!selectedChampId;
                            const colors = encounter.defender ? getChampionClassColors(encounter.defender.class as ChampionClass) : null;
                            const isLast = index === quest.encounters.length - 1;

                            return (
                                <div key={encounter.id} className="relative flex items-stretch group is-active pl-8 md:pl-10">
                                    {/* Timeline Node (Circle on the line) */}
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-[3px] shadow-lg font-black transition-all duration-300",
                                            hasSelection
                                                ? "bg-sky-600 border-slate-950 text-white shadow-[0_0_15px_rgba(2,132,199,0.5)] scale-110"
                                                : isLast
                                                    ? "bg-red-950 border-red-800 text-red-500 scale-110 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                                                    : "bg-slate-900 border-slate-800 text-slate-400 group-hover:border-slate-600"
                                        )}>
                                            {hasSelection ? <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" /> : (isLast ? <Crosshair className="h-4 w-4 md:h-5 md:w-5" /> : encounter.sequence)}
                                        </div>
                                    </div>

                                    {/* Horizontal Connector Line (from circle to card) */}
                                    <div className={cn(
                                        "absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-8 md:w-10 z-10 transition-colors duration-300",
                                        hasSelection ? "bg-sky-500/50" : (isLast ? "bg-red-800/50" : "bg-slate-800 group-hover:bg-slate-700")
                                    )} />

                                    {/* Card Content */}
                                    <Card
                                        className={cn(
                                            "flex-1 bg-slate-950/90 backdrop-blur-md border transition-all cursor-pointer overflow-hidden z-10 relative",
                                            hasSelection ? "border-sky-800/80 shadow-[0_0_20px_rgba(2,132,199,0.15)]" : (isLast ? "border-red-900/40 shadow-[0_0_20px_rgba(220,38,38,0.1)]" : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"),
                                            isExpanded && "ring-1 ring-slate-700 shadow-xl"
                                        )}
                                    >
                                        {/* Card Header (Always Visible) */}
                                        <div
                                            className="relative p-0 flex flex-col md:flex-row items-stretch min-h-[100px]"
                                            onClick={() => toggleExpand(encounter.id)}
                                        >
                                            {/* Left Side: Defender (Red/Orange Theme) */}
                                            <div className="relative flex-1 flex items-center p-4 md:p-5 md:pr-14 lg:pr-16 gap-4 z-10 before:absolute before:inset-0 before:bg-gradient-to-r before:from-red-950/20 before:to-transparent before:-z-10 min-w-0">
                                                {/* Defender Avatar */}
                                                <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-300">
                                                    <div className={`h-16 w-16 md:h-20 md:w-20 rounded-lg bg-slate-900 border-2 overflow-hidden relative z-10 ${colors ? colors.border : "border-slate-800 shadow-[0_0_15px_rgba(30,41,59,0.5)]"}`}>
                                                        {encounter.defender ? (
                                                            <Image
                                                                src={getChampionImageUrlOrPlaceholder(encounter.defender.images, "128")}
                                                                alt={encounter.defender.name}
                                                                fill
                                                                sizes="80px"
                                                                className="object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950">
                                                                <ShieldAlert className="h-8 w-8 md:h-10 md:w-10 opacity-50" />
                                                            </div>
                                                        )}
                                                        {/* Subtle inner gradient */}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                                    </div>
                                                    {encounter.defender && (
                                                        <div className="absolute -bottom-2.5 -right-2.5 z-20 h-7 w-7 md:h-8 md:w-8 bg-slate-950 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden p-1 shadow-lg">
                                                            <Image
                                                                src={`/assets/icons/${encounter.defender.class.charAt(0).toUpperCase() + encounter.defender.class.slice(1).toLowerCase()}.png`}
                                                                alt={encounter.defender.class}
                                                                fill
                                                                className="object-contain p-1"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <div className="text-[10px] text-red-500/80 font-black uppercase tracking-[0.2em] mb-0.5 flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                                            Target
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <CardTitle className={`text-lg md:text-2xl font-black truncate leading-none ${colors ? colors.text : "text-slate-300"}`}>
                                                            {encounter.defender?.name || "Unknown Defender"}
                                                        </CardTitle>
                                                        {encounter.videoUrl && (
                                                            <Youtube className="w-5 h-5 text-red-600 shrink-0" />
                                                        )}
                                                    </div>
                                                    {/* Mini node preview */}
                                                    {encounter.nodes.length > 0 && !isExpanded && (
                                                        <div className="flex gap-1 mt-2 flex-wrap">
                                                            {encounter.nodes.slice(0, 3).map((n: EncounterNodeWithRelations) => (
                                                                <Badge key={n.id} variant="secondary" className="text-[10px] py-0 h-4 bg-slate-950/80 border-slate-800 text-slate-400 font-medium">
                                                                    {n.nodeModifier.name}
                                                                </Badge>
                                                            ))}
                                                            {encounter.nodes.length > 3 && (
                                                                <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-slate-950/80 border-slate-800 text-slate-500 font-medium">
                                                                    +{encounter.nodes.length - 3}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* VS Centerpiece */}
                                            <div className="hidden md:flex absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-24 items-center justify-center z-20 pointer-events-none">
                                                <div className="relative flex items-center justify-center w-12 h-12">
                                                    <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0 text-slate-800 fill-slate-950 drop-shadow-xl">
                                                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" stroke="currentColor" strokeWidth="2" />
                                                    </svg>
                                                    <span className="relative z-10 text-sm font-black text-slate-500 italic uppercase tracking-tighter mix-blend-screen">VS</span>
                                                    {/* Stylized slash */}
                                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-700/20 to-transparent opacity-50 transform rotate-12" />
                                                </div>
                                            </div>

                                            {/* Right Side: Selected Counter (Blue/Sky Theme) */}
                                            <div className={cn(
                                                "relative flex-1 flex items-center p-4 md:p-5 md:pl-14 lg:pl-16 gap-4 border-t md:border-t-0 md:border-l border-slate-800/50 justify-between md:justify-end transition-colors z-10 min-w-0",
                                                hasSelection ? "before:absolute before:inset-0 before:bg-gradient-to-l before:from-sky-950/20 before:to-transparent before:-z-10" : ""
                                            )}>
                                                {hasSelection && selectedRosterItem ? (
                                                    <div className="flex items-center gap-4 w-full md:w-auto md:flex-row-reverse min-w-0 flex-1 md:flex-initial">
                                                        {(() => {
                                                            const champColors = getChampionClassColors(selectedRosterItem.champion.class as ChampionClass);
                                                            return (
                                                                <>
                                                                    <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-300">
                                                                        <div className={cn(
                                                                            "h-16 w-16 md:h-20 md:w-20 rounded-lg bg-slate-900 border-2 overflow-hidden relative z-10 shadow-[0_0_15px_rgba(2,132,199,0.3)]",
                                                                            getStarBorderClass(selectedRosterItem.stars)
                                                                        )}>
                                                                            <Image
                                                                                src={getChampionImageUrlOrPlaceholder(selectedRosterItem.champion.images, "128")}
                                                                                alt={selectedRosterItem.champion.name}
                                                                                fill
                                                                                sizes="80px"
                                                                                className="object-cover"
                                                                            />
                                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                                                        </div>

                                                                        <div className="absolute -bottom-2.5 -left-2.5 md:-left-auto md:-right-2.5 z-20 h-7 w-7 md:h-8 md:w-8 bg-slate-950 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden p-1 shadow-lg">
                                                                            <Image
                                                                                src={`/assets/icons/${selectedRosterItem.champion.class.charAt(0).toUpperCase() + selectedRosterItem.champion.class.slice(1).toLowerCase()}.png`}
                                                                                alt={selectedRosterItem.champion.class}
                                                                                fill
                                                                                className="object-contain p-1"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col flex-1 min-w-0 text-left md:text-right">
                                                                        <div className="text-[10px] text-sky-500/80 font-black uppercase tracking-[0.2em] mb-0.5 flex items-center md:flex-row-reverse gap-1.5">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] shrink-0" />
                                                                            Counter
                                                                        </div>
                                                                        <div className={cn("text-lg md:text-2xl font-black leading-none truncate w-full", champColors.text)}>
                                                                            {selectedRosterItem.champion.name}
                                                                        </div>
                                                                        <div className="flex items-center md:justify-end gap-1.5 mt-1.5 flex-wrap">
                                                                            <Badge variant="outline" className="text-[9px] font-black text-slate-300 bg-slate-900 border-slate-700 px-1.5 py-0 h-4 shrink-0">
                                                                                {selectedRosterItem.stars}★ R{selectedRosterItem.rank}
                                                                            </Badge>
                                                                            {selectedRosterItem.isAwakened && (
                                                                                <Badge variant="outline" className="text-[9px] font-black text-sky-400 bg-sky-950/50 border-sky-800 px-1.5 py-0 h-4 shrink-0">
                                                                                    S{selectedRosterItem.sigLevel}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex justify-center md:justify-end items-center">
                                                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800 border-dashed group-hover:border-slate-600 transition-colors flex items-center gap-2">
                                                            <Crosshair className="w-4 h-4" /> {readOnly ? 'No Counter Selected' : 'Pick Counter'}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex items-center flex-col md:flex-row gap-1 md:gap-2 ml-2 self-center md:self-auto">
                                                    {!readOnly && hasSelection && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="shrink-0 rounded-full hover:bg-red-950/80 hover:text-red-400 text-slate-500 h-8 w-8 transition-colors"
                                                            title="Remove selected counter"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectCounter(encounter.id, selectedChampId as number);
                                                            }}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-slate-800 h-8 w-8">
                                                        {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-800 bg-slate-900/20 p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">

                                                {/* Video Guide Section */}
                                                {encounter.videoUrl && (
                                                    <div className="mb-4">
                                                        {showVideoId === encounter.id ? (
                                                            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
                                                                {(() => {
                                                                    const videoId = getYoutubeId(encounter.videoUrl);
                                                                    if (videoId) {
                                                                        return (
                                                                            <iframe
                                                                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                                                                                title="YouTube video player"
                                                                                frameBorder="0"
                                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                                                allowFullScreen
                                                                                className="absolute inset-0 w-full h-full"
                                                                            ></iframe>
                                                                        );
                                                                    }
                                                                    return <div className="p-8 text-center text-slate-500">Invalid video URL</div>;
                                                                })()}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full h-8 w-8 z-50"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShowVideoId(null);
                                                                    }}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="group/video relative overflow-hidden rounded-xl border border-red-900/30 bg-gradient-to-r from-red-950/20 to-slate-900/40 p-4 cursor-pointer hover:border-red-600/50 transition-all active:scale-[0.99]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setShowVideoId(encounter.id);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="relative h-12 w-20 rounded bg-slate-950 flex items-center justify-center border border-slate-800 overflow-hidden shrink-0">
                                                                        <Youtube className="w-6 h-6 text-red-600 group-hover/video:scale-110 transition-transform" />
                                                                        <div className="absolute inset-0 bg-red-600/5 opacity-0 group-hover/video:opacity-100 transition-opacity" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-bold text-slate-200">Video Guide Available</h4>
                                                                        <p className="text-xs text-slate-500">Click to watch the strategy for this encounter</p>
                                                                    </div>
                                                                    <div className="ml-auto">
                                                                        <PlayCircle className="w-8 h-8 text-red-600/40 group-hover/video:text-red-600 transition-colors" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {(quest.minStarLevel || quest.maxStarLevel || quest.requiredClasses?.length || encounter.minStarLevel || encounter.maxStarLevel || encounter.requiredClasses?.length) ? (
                                                    <div className="flex flex-col gap-2 mb-4 bg-red-950/10 p-4 rounded-lg border border-red-900/30">
                                                        <div className="flex items-center gap-2 text-sm text-red-400 uppercase tracking-wide font-bold"><AlertCircle className="w-4 h-4" /> Quest & Encounter Restrictions Apply</div>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {[
                                                                quest.minStarLevel ? `Min ${quest.minStarLevel}★ (Quest)` : null,
                                                                quest.maxStarLevel ? `Max ${quest.maxStarLevel}★ (Quest)` : null,
                                                                quest.requiredClasses?.length ? `Class: ${quest.requiredClasses.join(', ')} (Quest)` : null,
                                                                encounter.minStarLevel ? `Min ${encounter.minStarLevel}★ (Encounter)` : null,
                                                                encounter.maxStarLevel ? `Max ${encounter.maxStarLevel}★ (Encounter)` : null,
                                                                encounter.requiredClasses?.length ? `Class: ${encounter.requiredClasses.join(', ')} (Encounter)` : null,
                                                                quest.requiredTags?.length ? `Quest Tags: ${quest.requiredTags.map((t) => t.name).join(', ')}` : null,
                                                                encounter.requiredTags?.length ? `Fight Tags: ${encounter.requiredTags.map((t) => t.name).join(', ')}` : null
                                                            ].filter(Boolean).map((req, i) => (
                                                                <Badge key={i} variant="outline" className="border-red-800/60 text-red-200 bg-red-950/40">{req}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Nodes & Tips Grid */}
                                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pt-2">
                                                    {/* Nodes */}
                                                    <div className="xl:col-span-7 space-y-4">
                                                        {encounter.nodes.length > 0 && (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-6 w-1 bg-sky-500 rounded-full" />
                                                                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-[0.2em]">Encounter Nodes</h4>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {encounter.nodes.map((n: EncounterNodeWithRelations) => (
                                                                        <div key={n.id} className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 group/node transition-all hover:border-sky-800/50 hover:bg-slate-900/50">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <div className="p-1 rounded bg-sky-500/10 text-sky-500 shrink-0">
                                                                                    <Info className="w-3.5 h-3.5" />
                                                                                </div>
                                                                                <span className="font-bold text-sm text-slate-100">{n.nodeModifier.name}</span>
                                                                            </div>
                                                                            <span className="text-xs text-slate-400 leading-normal block pl-8 pr-2">{n.nodeModifier.description}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Tips */}
                                                        {encounter.tips && (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-6 w-1 bg-indigo-500 rounded-full" />
                                                                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em]">Strategy & Tips</h4>
                                                                </div>
                                                                <div className="bg-indigo-950/20 p-5 rounded-xl border border-indigo-900/40 text-indigo-100 text-sm leading-relaxed shadow-inner">
                                                                    <SimpleMarkdown content={encounter.tips} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Suggested Counters Area */}
                                                    <div className="xl:col-span-5 space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-1 bg-amber-500 rounded-full" />
                                                            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em]">Suggested Counters</h4>
                                                        </div>

                                                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
                                                            {/* Suggested Tags */}
                                                            {encounter.recommendedTags.length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {encounter.recommendedTags.map((tag: string) => (
                                                                        <Badge key={tag} variant="outline" className="text-[10px] uppercase font-bold bg-amber-950/20 border-amber-800/50 text-amber-400 py-1 px-2.5 rounded-full flex gap-2 items-center tracking-wider shadow-sm">
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span> {tag}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Recommended Champions List */}
                                                            {encounter.recommendedChampions.length > 0 ? (
                                                                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3">
                                                                    {encounter.recommendedChampions.map((c) => {
                                                                        if (readOnly) {
                                                                            // In readOnly mode, just show the champion reference without roster matching
                                                                            return (
                                                                                <div key={c.id}>
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
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        }

                                                                        // Find highest version in roster that matches restrictions
                                                                        const userChamp = roster
                                                                            .filter(r => r.championId === c.id)
                                                                            .filter(r => {
                                                                                if (quest.minStarLevel && r.stars < quest.minStarLevel) return false;
                                                                                if (quest.maxStarLevel && r.stars > quest.maxStarLevel) return false;
                                                                                if (encounter.minStarLevel && r.stars < encounter.minStarLevel) return false;
                                                                                if (encounter.maxStarLevel && r.stars > encounter.maxStarLevel) return false;
                                                                                if (encounter.requiredTags && encounter.requiredTags.length > 0) {
                                                                                    const hasTag = encounter.requiredTags.some(tag => r.champion.tags?.some(ct => ct.id === tag.id));
                                                                                    if (!hasTag) return false;
                                                                                }
                                                                                return true;
                                                                            })
                                                                            .sort((a, b) => b.stars - a.stars || b.rank - a.rank)[0];

                                                                        const isSelected = selections[encounter.id] === userChamp?.championId;
                                                                        const isInTeam = userChamp ? Object.values(selections).includes(userChamp.championId) : Object.values(selections).includes(c.id);

                                                                        return (
                                                                            <div
                                                                                key={c.id}
                                                                                onClick={() => userChamp && handleSelectCounter(encounter.id, userChamp.championId)}
                                                                                className="cursor-pointer group"
                                                                            >
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
                                                                                    isRecommended={!isSelected}
                                                                                    isMissing={!userChamp}
                                                                                    isInTeam={isInTeam}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-500 italic py-4 text-center border border-dashed border-slate-800 rounded-lg">No specific champions recommended for this encounter.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Roster Selection — hidden in readOnly mode */}
                                                {!readOnly && (
                                                <div className="space-y-4 pt-8 border-t border-slate-800/50">
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-1 bg-sky-600 rounded-full" />
                                                                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-[0.2em]">Select from Your Roster</h4>
                                                            </div>

                                                            <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
                                                                <div className="relative flex-1">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                                                    <Input
                                                                        placeholder="Search your roster..."
                                                                        className="pl-9 h-10 bg-slate-900/50 border-slate-800 text-sm focus-visible:ring-sky-500"
                                                                        value={searchQuery}
                                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                                    />
                                                                    {searchQuery && (
                                                                        <button
                                                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded"
                                                                            onClick={() => setSearchQuery("")}
                                                                        >
                                                                            <X className="h-3 w-3 text-slate-500" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    <div className="flex gap-1.5 p-1 bg-slate-950/50 border border-slate-800 rounded-lg overflow-x-auto custom-scrollbar">
                                                                        {CLASSES.filter(cls => cls !== 'SUPERIOR').map((cls) => (
                                                                            <button
                                                                                key={cls}
                                                                                onClick={() => setSelectedClass(selectedClass === cls ? null : cls)}
                                                                                className={cn(
                                                                                    "p-1.5 rounded-md border transition-all shrink-0",
                                                                                    selectedClass === cls ? "bg-sky-600 border-sky-400 shadow-[0_0_10px_rgba(2,132,199,0.3)]" : "bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-700"
                                                                                )}
                                                                                title={cls}
                                                                            >
                                                                                <div className="relative w-5 h-5">
                                                                                    <Image src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`} alt={cls} fill className="object-contain" />
                                                                                </div>
                                                                            </button>
                                                                        ))}
                                                                    </div>

                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                                                        className={cn(
                                                                            "h-10 px-3 border-slate-800 gap-2 shrink-0",
                                                                            showAdvancedFilters || activeFiltersCount > 0 ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700" : "bg-slate-900/50 text-slate-400"
                                                                        )}
                                                                    >
                                                                        <Filter className="w-4 h-4" />
                                                                        {activeFiltersCount > 0 && <span className="bg-white text-indigo-700 text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Advanced Filters Panel */}
                                                        {showAdvancedFilters && (
                                                            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center animate-in slide-in-from-top-2 duration-200">
                                                                <MultiSelectFilter title="Tags" icon={TagIcon} options={filterMetadata.tags} selectedValues={tagFilter} onSelect={setTagFilter} logic={tagLogic} onLogicChange={setTagLogic} />
                                                                <MultiSelectFilter title="Categories" icon={BookOpen} options={filterMetadata.abilityCategories} selectedValues={abilityCategoryFilter} onSelect={setAbilityCategoryFilter} logic={abilityCategoryLogic} onLogicChange={setAbilityCategoryLogic} />
                                                                <MultiSelectFilter title="Abilities" icon={Zap} options={filterMetadata.abilities} selectedValues={abilityFilter} onSelect={setAbilityFilter} logic={abilityLogic} onLogicChange={setAbilityLogic} />
                                                                <MultiSelectFilter title="Immunities" icon={Shield} options={filterMetadata.immunities} selectedValues={immunityFilter} onSelect={setImmunityFilter} logic={immunityLogic} onLogicChange={setImmunityLogic} />
                                                            </div>
                                                        )}

                                                        {/* Active Filter Badges */}
                                                        <div className="flex flex-wrap gap-2 items-center">
                                                            {/* Read-only requirements from Quest/Encounter */}
                                                            {quest.requiredTags?.map((t: Tag) => (
                                                                <Badge key={`req-q-${t.id}`} variant="outline" className="bg-red-950/20 border-red-800/40 text-red-400 h-7 text-[10px] uppercase font-bold px-2.5 flex items-center gap-1.5">
                                                                    <ShieldAlert className="w-3 h-3" /> Quest Req: {t.name}
                                                                </Badge>
                                                            ))}
                                                            {encounter.requiredTags?.map((t: any) => (
                                                                <Badge key={`req-e-${t.id}`} variant="outline" className="bg-red-950/20 border-red-800/40 text-red-400 h-7 text-[10px] uppercase font-bold px-2.5 flex items-center gap-1.5">
                                                                    <ShieldAlert className="w-3 h-3" /> Fight Req: {t.name}
                                                                </Badge>
                                                            ))}

                                                            {/* User-selected removable filters */}
                                                            {tagFilter.map(tag => (
                                                                <Badge key={`f-tag-${tag}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                                                    Tag: {tag}
                                                                    <button onClick={() => setTagFilter(tagFilter.filter(t => t !== tag))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                                                </Badge>
                                                            ))}
                                                            {abilityCategoryFilter.map(cat => (
                                                                <Badge key={`f-cat-${cat}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                                                    Cat: {cat}
                                                                    <button onClick={() => setAbilityCategoryFilter(abilityCategoryFilter.filter(c => c !== cat))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                                                </Badge>
                                                            ))}
                                                            {abilityFilter.map(ab => (
                                                                <Badge key={`f-ab-${ab}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                                                    Ability: {ab}
                                                                    <button onClick={() => setAbilityFilter(abilityFilter.filter(a => a !== ab))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                                                </Badge>
                                                            ))}
                                                            {immunityFilter.map(imm => (
                                                                <Badge key={`f-imm-${imm}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                                                    Immunity: {imm}
                                                                    <button onClick={() => setImmunityFilter(immunityFilter.filter(i => i !== imm))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                                                </Badge>
                                                            ))}

                                                            {activeFiltersCount > 0 && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 text-[10px] text-red-400 hover:text-red-300 uppercase font-black tracking-widest px-2"
                                                                    onClick={clearAllFilters}
                                                                >
                                                                    <Trash2 className="w-3 h-3 mr-1" /> Clear All
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {(() => {
                                                        const encounterRoster = filteredGlobalRoster.filter(r => {
                                                            // Quest-level restrictions
                                                            if (quest.minStarLevel && r.stars < quest.minStarLevel) return false;
                                                            if (quest.maxStarLevel && r.stars > quest.maxStarLevel) return false;
                                                            if (quest.requiredClasses && quest.requiredClasses.length > 0 && !quest.requiredClasses.includes(r.champion.class)) return false;
                                                            if (quest.requiredTags && quest.requiredTags.length > 0) {
                                                                const hasTag = quest.requiredTags.some((tag: Tag) => r.champion.tags?.some(ct => ct.id === tag.id));
                                                                if (!hasTag) return false;
                                                            }
                                                            // Encounter-level restrictions
                                                            if (encounter.minStarLevel && r.stars < encounter.minStarLevel) return false;
                                                            if (encounter.maxStarLevel && r.stars > encounter.maxStarLevel) return false;
                                                            if (encounter.requiredClasses && encounter.requiredClasses.length > 0 && !encounter.requiredClasses.includes(r.champion.class)) return false;
                                                            if (encounter.requiredTags && encounter.requiredTags.length > 0) {
                                                                const hasTag = (encounter.requiredTags as Tag[]).some(tag => r.champion.tags?.some(ct => ct.id === tag.id));
                                                                if (!hasTag) return false;
                                                            }

                                                            return true;
                                                        }).sort((a, b) => {
                                                            // Selected first
                                                            if (selections[encounter.id] === a.championId) return -1;
                                                            if (selections[encounter.id] === b.championId) return 1;
                                                            return 0;
                                                        });

                                                        if (roster.length === 0) {
                                                            return (
                                                                <div className="p-8 text-center border border-dashed border-slate-700 bg-slate-900/30 rounded-xl">
                                                                    <p className="text-slate-400 text-lg">Your roster is empty.</p>
                                                                    <p className="text-slate-500 text-sm mt-2">Go to the Roster section to add some champions before planning!</p>
                                                                </div>
                                                            );
                                                        }

                                                        if (encounterRoster.length === 0) {
                                                            return (
                                                                <div className="p-6 text-center border border-dashed border-slate-800 bg-slate-900/20 rounded-xl">
                                                                    <p className="text-slate-400">No champions in your roster match the current filters or quest restrictions.</p>
                                                                </div>
                                                            )
                                                        }

                                                        return (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14 gap-y-4 gap-x-2 max-h-[450px] overflow-y-auto p-2 pt-4 border border-slate-800/50 bg-slate-950/30 rounded-xl custom-scrollbar">
                                                                    {encounterRoster.slice(0, 30).map((r: RosterWithChampion) => {
                                                                        const isSelected = selections[encounter.id] === r.championId;
                                                                        const isRecommended = (encounter.recommendedChampions as unknown as Champion[]).some((rc: Champion) => rc.id === r.championId);
                                                                        const isInTeam = Object.values(selections).includes(r.championId);

                                                                        return (
                                                                            <div
                                                                                key={r.id}
                                                                                onClick={() => handleSelectCounter(encounter.id, r.championId)}
                                                                                title={`${r.champion.name} - ${r.stars}★ Rank ${r.rank} Sig ${r.sigLevel || 0}`}
                                                                                className="cursor-pointer"
                                                                            >
                                                                                <UpdatedChampionItem
                                                                                    item={{
                                                                                        stars: r.stars,
                                                                                        rank: r.rank,
                                                                                        isAwakened: r.isAwakened,
                                                                                        sigLevel: r.sigLevel,
                                                                                        powerRating: r.powerRating,
                                                                                        champion: {
                                                                                            id: r.champion.id,
                                                                                            name: r.champion.shortName || r.champion.name,
                                                                                            championClass: r.champion.class,
                                                                                            images: r.champion.images
                                                                                        },
                                                                                        isAscended: r.isAscended
                                                                                    }}
                                                                                    isSelected={isSelected}
                                                                                    isRecommended={isRecommended}
                                                                                    isInTeam={isInTeam}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                {encounterRoster.length > 30 && (
                                                                    <div className="text-center p-3 bg-slate-900/30 border border-slate-800 border-dashed rounded-lg">
                                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                                                            Showing first 30 of {encounterRoster.length} matches. Use search or filters to narrow down.
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                )}

                                            </div>
                                        )}
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
