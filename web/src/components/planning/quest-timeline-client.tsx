"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { QuestPlan, QuestEncounter, Champion as PrismaChampion, Roster, PlayerQuestEncounter, Tag, QuestEncounterNode, NodeModifier, ChampionClass, Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, CheckCircle2, ShieldAlert, AlertCircle, Info, Search, X } from "lucide-react";
import { savePlayerQuestCounter } from "@/app/actions/quests";
import { getChampionImageUrl, getStarBorderClass } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionAvatar } from "@/components/champion-avatar";
import { UpdatedChampionItem } from "@/components/UpdatedChampionItem";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { cn } from "@/lib/utils";
import { ChampionImages, Champion } from "@/types/champion";

import { getQuestPlanById } from "@/app/actions/quests";

type QuestWithRelations = NonNullable<Prisma.PromiseReturnType<typeof getQuestPlanById>>;
type EncounterWithRelations = QuestWithRelations["encounters"][0];
type EncounterNodeWithRelations = EncounterWithRelations["nodes"][0];

type RosterWithChampion = Roster & {
    champion: Champion;
};

interface Props {
    quest: QuestWithRelations;
    roster: RosterWithChampion[];
    savedEncounters: PlayerQuestEncounter[];
}

const CLASSES = Object.values(ChampionClass);

export default function QuestTimelineClient({ quest, roster, savedEncounters }: Props) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClass, setSelectedClass] = useState<ChampionClass | null>(null);

    // Track selections locally for immediate UI updates
    const [selections, setSelections] = useState<Record<string, number | null>>(() => {
        const initial: Record<string, number | null> = {};
        savedEncounters.forEach(se => {
            initial[se.questEncounterId] = se.selectedChampionId;
        });
        return initial;
    });

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const filteredGlobalRoster = useMemo(() => {
        return roster.filter(r => {
            // Search query
            if (searchQuery && !r.champion.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.champion.shortName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            // Class filter
            if (selectedClass && r.champion.class !== selectedClass) return false;

            return true;
        });
    }, [roster, searchQuery, selectedClass]);

    const handleSelectCounter = async (encounterId: string, championId: number) => {
        const previousValue = selections[encounterId];
        const newValue = previousValue === championId ? null : championId;
        setSelections(prev => ({ ...prev, [encounterId]: newValue }));

        try {
            await savePlayerQuestCounter(quest.id, encounterId, newValue);
        } catch (error) {
            console.error("Failed to save counter selection", error);
            setSelections(prev => ({ ...prev, [encounterId]: previousValue }));
        }
    };

    const selectedTeam = useMemo(() => {
        const uniqueChampionIds = new Set<number>();
        Object.values(selections).forEach(id => {
            if (id !== null) uniqueChampionIds.add(id);
        });

        const team: RosterWithChampion[] = [];
        uniqueChampionIds.forEach(id => {
            const r = roster.find(rosterItem => rosterItem.championId === id);
            if (r) team.push(r);
        });
        return team;
    }, [selections, roster]);

    return (
        <div className="relative pt-4 pb-20">
            {quest.teamLimit !== null && quest.teamLimit > 0 && (
                <div className="sticky top-[72px] z-40 mb-8 -mx-4 md:mx-0 px-4 md:px-0">
                    <Card className="bg-slate-950/95 border-sky-900/40 shadow-xl shadow-black/50 backdrop-blur-md">
                        <CardHeader className="py-2.5 px-4 border-b border-slate-800/50 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                                Current Team Plan
                            </CardTitle>
                            <Badge variant={selectedTeam.length > quest.teamLimit ? "destructive" : "secondary"} className={cn(
                                "font-bold",
                                selectedTeam.length > quest.teamLimit ? "bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]" : "bg-sky-950 text-sky-400 border border-sky-800"
                            )}>
                                {selectedTeam.length} / {quest.teamLimit}
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-3">
                            {selectedTeam.length === 0 ? (
                                <p className="text-xs text-slate-500 italic text-center py-2">No champions selected. Pick counters below.</p>
                            ) : (
                                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                    {selectedTeam.map(r => (
                                        <div key={r.id} className="w-[85px] sm:w-[95px] shrink-0">
                                            <UpdatedChampionItem
                                                variant="tall"
                                                item={{
                                                    stars: r.stars,
                                                    rank: r.rank,
                                                    isAwakened: r.isAwakened,
                                                    sigLevel: r.sigLevel,
                                                    powerRating: r.powerRating,
                                                    champion: {
                                                        id: r.champion.id,
                                                        name: r.champion.name,
                                                        championClass: r.champion.class,
                                                        images: r.champion.images
                                                    }
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedTeam.length > quest.teamLimit && (
                                <div className="mt-2 text-xs text-red-300 bg-red-950/40 px-3 py-1.5 rounded-md border border-red-900/50 flex items-center gap-2 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Over team limit
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-800 before:via-slate-800 before:to-transparent">
                {quest.encounters.length === 0 ? (
                    <p className="text-center text-slate-400 italic mt-8">No encounters have been added to this quest yet.</p>
                ) : (
                    <div className="space-y-8">
                        {quest.encounters.map((encounter: EncounterWithRelations) => {
                            const isExpanded = expandedId === encounter.id;
                            const selectedChampId = selections[encounter.id];
                            const selectedRosterItem = selectedChampId ? roster.find(r => r.championId === selectedChampId) : null;
                            const hasSelection = !!selectedChampId;
                            const colors = encounter.defender ? getChampionClassColors(encounter.defender.class as ChampionClass) : null;

                            return (
                                <div key={encounter.id} className="relative flex items-center group is-active">
                                    {/* Timeline Dot (Sequence / Status) */}
                                    <div className={cn(
                                        "flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full border-2 shadow shrink-0 absolute left-0 transform -translate-x-1/2 font-bold z-10 transition-colors",
                                        hasSelection ? "bg-sky-600 border-sky-400 text-white" : "bg-slate-900 border-slate-700 text-slate-300"
                                    )}>
                                        {hasSelection ? <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" /> : encounter.sequence}
                                    </div>

                                    {/* Card Content */}
                                    <Card
                                        className={cn(
                                            "w-[calc(100%-3rem)] ml-12 md:ml-16 bg-slate-950/90 backdrop-blur-sm border transition-all cursor-pointer overflow-hidden",
                                            hasSelection ? "border-sky-800 shadow-[0_0_15px_rgba(2,132,199,0.15)]" : "border-slate-800 hover:border-slate-700"
                                        )}
                                    >
                                        {/* Card Header (Always Visible) */}
                                        <div
                                            className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
                                            onClick={() => toggleExpand(encounter.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Defender Avatar */}
                                                <div className="relative shrink-0">
                                                    <div className={`h-16 w-16 rounded-md bg-slate-900 border-2 overflow-hidden relative z-10 ${colors ? colors.border : "border-slate-800 shadow-[0_0_15px_rgba(30,41,59,0.5)]"}`}>
                                                        {encounter.defender ? (
                                                            <Image
                                                                src={getChampionImageUrl(encounter.defender.images, "128")}
                                                                alt={encounter.defender.name}
                                                                fill
                                                                sizes="64px"
                                                                className="object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                                <ShieldAlert className="h-8 w-8" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {encounter.defender && (
                                                        <div className="absolute -bottom-2 -right-2 z-20 h-6 w-6 bg-slate-950 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden p-0.5 shadow-lg">
                                                            <Image
                                                                src={`/icons/${encounter.defender.class.charAt(0).toUpperCase() + encounter.defender.class.slice(1).toLowerCase()}.png`}
                                                                alt={encounter.defender.class}
                                                                width={20}
                                                                height={20}
                                                                className="object-contain"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col">
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Defender</div>
                                                    <CardTitle className={`text-xl font-black ${colors ? colors.text : "text-slate-200"}`}>{encounter.defender?.name || "Unknown Defender"}</CardTitle>
                                                    {/* Mini node preview */}
                                                    {encounter.nodes.length > 0 && !isExpanded && (
                                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                                            {encounter.nodes.map((n: EncounterNodeWithRelations) => (
                                                                <Badge key={n.id} variant="secondary" className="text-[10px] py-0 h-4 bg-slate-900/80 border-slate-800 text-slate-400 font-normal">
                                                                    {n.nodeModifier.name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* VS Indicator (Hidden on mobile) */}
                                            <div className="hidden lg:flex flex-1 items-center justify-center px-4">
                                                <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent w-full relative">
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-950 px-3 py-1 border border-slate-800 rounded-full shadow-xl">
                                                        <span className="text-[10px] font-black text-slate-500 italic uppercase tracking-tighter">VS</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                                                {/* Selected Counter Preview */}
                                                {hasSelection && selectedRosterItem ? (
                                                    <div className="flex items-center gap-4">
                                                        {(() => {
                                                            const champColors = getChampionClassColors(selectedRosterItem.champion.class as ChampionClass);
                                                            return (
                                                                <>
                                                                    <div className="hidden sm:flex flex-col items-end">
                                                                        <div className={cn("text-xl font-black leading-tight text-right", champColors.text)}>
                                                                            {selectedRosterItem.champion.name}
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[10px] font-black text-slate-300 bg-slate-800 px-1.5 py-0 rounded">
                                                                                {selectedRosterItem.stars}★
                                                                            </span>
                                                                            <span className="text-[10px] font-black text-slate-300 bg-slate-800 px-1.5 py-0 rounded">
                                                                                RANK {selectedRosterItem.rank}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="relative shrink-0">
                                                                        <div className={cn(
                                                                            "h-16 w-16 rounded-md bg-slate-900 border-2 overflow-hidden relative z-10",
                                                                            getStarBorderClass(selectedRosterItem.stars)
                                                                        )}>
                                                                            <Image
                                                                                src={getChampionImageUrl(selectedRosterItem.champion.images, "128")}
                                                                                alt={selectedRosterItem.champion.name}
                                                                                fill
                                                                                sizes="64px"
                                                                                className="object-cover"
                                                                            />
                                                                        </div>

                                                                        {/* Class Icon Overlay */}
                                                                        <div className="absolute -bottom-2 -left-2 z-20 h-6 w-6 bg-slate-950 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden p-0.5 shadow-lg">
                                                                            <Image
                                                                                src={`/icons/${selectedRosterItem.champion.class.charAt(0).toUpperCase() + selectedRosterItem.champion.class.slice(1).toLowerCase()}.png`}
                                                                                alt={selectedRosterItem.champion.class}
                                                                                width={20}
                                                                                height={20}
                                                                                className="object-contain"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs font-bold uppercase tracking-widest text-slate-600 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800 border-dashed">No counter picked</div>
                                                )}
                                                <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-slate-800 ml-2">                                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-800 bg-slate-900/20 p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">

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
                                                                quest.requiredTags?.length ? `Tag: Any from Quest Requirements` : null
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
                                                                                                                    {(encounter.recommendedChampions as unknown as Champion[]).length > 0 ? (
                                                                                                                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                                                                                            {(encounter.recommendedChampions as unknown as Champion[]).map((c: Champion) => {                                                                        // Find highest version in roster that matches restrictions
                                                                        const userChamp = roster
                                                                            .filter(r => r.championId === c.id)
                                                                            .filter(r => {
                                                                                if (quest.minStarLevel && r.stars < quest.minStarLevel) return false;
                                                                                if (quest.maxStarLevel && r.stars > quest.maxStarLevel) return false;
                                                                                if (encounter.minStarLevel && r.stars < encounter.minStarLevel) return false;
                                                                                if (encounter.maxStarLevel && r.stars > encounter.maxStarLevel) return false;
                                                                                return true;
                                                                            })
                                                                            .sort((a, b) => b.stars - a.stars || b.rank - a.rank)[0];

                                                                        const isSelected = selections[encounter.id] === userChamp?.championId;

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
                                                                                            id: c.id,
                                                                                                                                                                                    name: c.shortName || c.name,
                                                                                                                                                                                    championClass: c.class,
                                                                                                                                                                                    images: c.images
                                                                                                                                                                                }
                                                                                                                                                                            } : {                                                                                        stars: 0,
                                                                                        rank: 0,
                                                                                                                                                                            champion: {
                                                                                                                                                                                id: c.id,
                                                                                                                                                                                name: c.shortName || c.name,
                                                                                                                                                                                championClass: c.class,
                                                                                                                                                                                images: c.images
                                                                                                                                                                            }
                                                                                                                                                                        }}                                                                                    isSelected={isSelected}
                                                                                    isRecommended={!isSelected}
                                                                                    isMissing={!userChamp}
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

                                                {/* Roster Selection */}
                                                <div className="space-y-4 pt-8 border-t border-slate-800/50">
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
                                                            <div className="flex gap-1.5 p-1 bg-slate-950/50 border border-slate-800 rounded-lg overflow-x-auto custom-scrollbar">
                                                                {CLASSES.map((cls) => (
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
                                                                            <Image src={`/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`} alt={cls} fill className="object-contain" />
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(() => {
                                                        const encounterRoster = filteredGlobalRoster.filter(r => {
                                                            // Quest-level restrictions
                                                            if (quest.minStarLevel && r.stars < quest.minStarLevel) return false;
                                                            if (quest.maxStarLevel && r.stars > quest.maxStarLevel) return false;
                                                            if (quest.requiredClasses && quest.requiredClasses.length > 0 && !quest.requiredClasses.includes(r.champion.class)) return false;
                                                                                                                    if (quest.requiredTags && quest.requiredTags.length > 0) {
                                                                                                                        const hasTag = quest.requiredTags.some(tag => r.champion.tags?.some(ct => ct.id === tag.id));
                                                                                                                        if (!hasTag) return false;
                                                                                                                    }
                                                            // Encounter-level restrictions
                                                            if (encounter.minStarLevel && r.stars < encounter.minStarLevel) return false;
                                                            if (encounter.maxStarLevel && r.stars > encounter.maxStarLevel) return false;
                                                            if (encounter.requiredClasses && encounter.requiredClasses.length > 0 && !encounter.requiredClasses.includes(r.champion.class)) return false;

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
                                                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-y-4 gap-x-2 max-h-[450px] overflow-y-auto p-2 pt-4 border border-slate-800/50 bg-slate-950/30 rounded-xl custom-scrollbar">
                                                                {encounterRoster.slice(0, 100).map((r: RosterWithChampion) => {
                                                                    const isSelected = selections[encounter.id] === r.championId;
                                                                    const isRecommended = (encounter.recommendedChampions as unknown as Champion[]).some((rc: Champion) => rc.id === r.championId);

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
                                                                                    }
                                                                                }}
                                                                                isSelected={isSelected}
                                                                                isRecommended={isRecommended}
                                                                            />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

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
