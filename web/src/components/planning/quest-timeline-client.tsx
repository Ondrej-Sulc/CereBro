"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { QuestPlan, QuestEncounter, Champion, Roster, PlayerQuestEncounter, Tag, QuestEncounterNode, NodeModifier, ChampionClass } from "@prisma/client";
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

type EncounterNodeWithRelations = QuestEncounterNode & { nodeModifier: NodeModifier };

type EncounterWithRelations = QuestEncounter & {
    defender: Champion | null;
    recommendedChampions: Champion[];
    requiredTags: Tag[];
    nodes: EncounterNodeWithRelations[];
};

type QuestWithRelations = QuestPlan & {
    encounters: EncounterWithRelations[];
    requiredTags?: Tag[];
};

type RosterWithChampion = Roster & {
    champion: Champion & {
        tags: Tag[];
    };
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
        // Toggle off if already selected, otherwise select
        const newValue = selections[encounterId] === championId ? null : championId;
        setSelections(prev => ({ ...prev, [encounterId]: newValue }));

        // Save to DB
        try {
            await savePlayerQuestCounter(quest.id, encounterId, newValue);
        } catch (error) {
            console.error("Failed to save counter selection", error);
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
                                                        images: r.champion.images as any
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
                        const colors = encounter.defender ? getChampionClassColors(encounter.defender.class as any) : null;

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
                                                <div className={`h-16 w-16 rounded-md bg-slate-900 border-2 overflow-hidden relative z-10 ${colors ? colors.border : "border-slate-800"}`}>
                                                    {encounter.defender ? (
                                                        <Image
                                                            src={getChampionImageUrl(encounter.defender.images as any, "128")}
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
                                                    <div className="absolute -bottom-2 -right-2 z-20 h-6 w-6 bg-slate-900 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden p-0.5">
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

                                            <div>
                                                <CardTitle className={`text-xl ${colors ? colors.text : ""}`}>{encounter.defender?.name || "Unknown Defender"}</CardTitle>
                                                {/* Mini node preview */}
                                                {encounter.nodes.length > 0 && !isExpanded && (
                                                    <div className="flex gap-1 mt-2 flex-wrap">
                                                        {encounter.nodes.map((n: EncounterNodeWithRelations) => (
                                                            <Badge key={n.id} variant="secondary" className="text-xs py-0 h-5 bg-slate-900 border-slate-800 text-slate-400">
                                                                {n.nodeModifier.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                                            {/* Selected Counter Preview */}
                                            {hasSelection && selectedRosterItem ? (
                                                <div className="flex items-center gap-3 bg-sky-950/40 px-3 py-2 rounded-xl border border-sky-800 shadow-[0_0_10px_rgba(2,132,199,0.2)]">
                                                    <ChampionAvatar 
                                                        name={selectedRosterItem.champion.name}
                                                        images={selectedRosterItem.champion.images as any}
                                                        championClass={selectedRosterItem.champion.class}
                                                        stars={selectedRosterItem.stars}
                                                        rank={selectedRosterItem.rank}
                                                        isAwakened={selectedRosterItem.isAwakened}
                                                        sigLevel={selectedRosterItem.sigLevel || 0}
                                                        size="sm"
                                                        showStars
                                                        showRank
                                                    />
                                                    <div className="hidden sm:flex flex-col">
                                                        <div className="text-sm font-bold text-sky-100 leading-tight">{selectedRosterItem.champion.name}</div>
                                                        <div className="text-[10px] text-sky-400 font-medium">Selected Counter</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm font-medium text-slate-500 italic bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800 border-dashed">No counter selected</div>
                                            )}

                                            <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-slate-800">
                                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                                {/* Nodes */}
                                                {encounter.nodes.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-semibold text-sky-400 uppercase tracking-wider">Node Buffs</h4>
                                                        <div className="space-y-2">
                                                            {encounter.nodes.map((n: EncounterNodeWithRelations) => (
                                                                <div key={n.id} className="bg-slate-900/50 p-3 rounded-md border border-slate-800/80 group/node transition-colors hover:border-sky-800">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Info className="w-4 h-4 text-sky-600 shrink-0" />
                                                                        <span className="font-semibold text-slate-200">{n.nodeModifier.name}</span>
                                                                    </div>
                                                                    <span className="text-sm text-slate-400 leading-snug block pl-6">{n.nodeModifier.description}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Tips */}
                                                {encounter.tips && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Quick Tips</h4>
                                                        <div className="bg-indigo-950/20 p-4 rounded-md border border-indigo-900/40 text-indigo-100 text-sm leading-relaxed">
                                                            <SimpleMarkdown content={encounter.tips} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Roster Selection */}
                                            <div className="space-y-4 pt-4 border-t border-slate-800/50">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider shrink-0">Select Your Counter</h4>

                                                    <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
                                                        <div className="relative flex-1">
                                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                                            <Input
                                                                placeholder="Search champions..."
                                                                className="pl-9 h-9 bg-slate-900/50 border-slate-800 text-sm"
                                                                value={searchQuery}
                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                            />
                                                            {searchQuery && (
                                                                <button
                                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 hover:text-slate-300"
                                                                    onClick={() => setSearchQuery("")}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                                                            {CLASSES.map((cls) => (
                                                                <button
                                                                    key={cls}
                                                                    onClick={() => setSelectedClass(selectedClass === cls ? null : cls)}
                                                                    className={cn(
                                                                        "p-1.5 rounded border transition-all shrink-0",
                                                                        selectedClass === cls ? "bg-sky-600 border-sky-400 shadow-[0_0_8px_rgba(2,132,199,0.5)]" : "bg-slate-900 border-slate-800 hover:border-slate-600"
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

                                                    {/* Recommendations hints */}
                                                    {(encounter.recommendedTags.length > 0) && (
                                                        <div className="flex gap-2">
                                                            {encounter.recommendedTags.map((tag: string) => (
                                                                <Badge key={tag} variant="outline" className="text-xs bg-amber-950/30 border-amber-800 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.15)] flex gap-1 items-center">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> {tag}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Specific Recommended Champions Visual */}
                                                {encounter.recommendedChampions.length > 0 && (
                                                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center text-sm py-2 px-1">
                                                        <span className="text-slate-400 font-medium shrink-0">Recommended:</span>
                                                        <div className="flex flex-wrap gap-3">
                                                            {encounter.recommendedChampions.map((c: Champion) => {
                                                                // Find highest version in roster that matches restrictions
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
                                                                        title={userChamp ? `Click to select your ${userChamp.stars}★ R${userChamp.rank} ${c.name}` : `You don't have ${c.name} meeting requirements`}
                                                                        className="w-[85px] sm:w-[95px] cursor-pointer"
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
                                                                                    images: c.images as any
                                                                                }
                                                                            } : {
                                                                                stars: 0,
                                                                                rank: 0,
                                                                                champion: {
                                                                                    id: c.id,
                                                                                    name: c.shortName || c.name,
                                                                                    championClass: c.class,
                                                                                    images: c.images as any
                                                                                }
                                                                            }}
                                                                            isSelected={isSelected}
                                                                            isRecommended={!isSelected}
                                                                            isMissing={!userChamp}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {(() => {
                                                    const encounterRoster = filteredGlobalRoster.filter(r => {
                                                        // Quest-level restrictions
                                                        if (quest.minStarLevel && r.stars < quest.minStarLevel) return false;
                                                        if (quest.maxStarLevel && r.stars > quest.maxStarLevel) return false;
                                                        if (quest.requiredClasses && quest.requiredClasses.length > 0 && !quest.requiredClasses.includes(r.champion.class)) return false;
                                                        if (quest.requiredTags && quest.requiredTags.length > 0) {
                                                            const hasTag = quest.requiredTags.some((tag: Tag) => r.champion.tags.some((ct: Tag) => ct.id === tag.id));
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
                                                                const isRecommended = encounter.recommendedChampions.some((rc: Champion) => rc.id === r.championId);

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
                                                                                    images: r.champion.images as any
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
