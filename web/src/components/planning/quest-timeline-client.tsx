"use client";

import { useState } from "react";
import Image from "next/image";
import { QuestPlan, QuestEncounter, Champion, Roster, PlayerQuestEncounter, Tag, QuestEncounterNode, NodeModifier } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, CheckCircle2, ShieldAlert } from "lucide-react";
import { savePlayerQuestCounter } from "@/app/actions/quests";

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

export default function QuestTimelineClient({ quest, roster, savedEncounters }: Props) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

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

    return (
        <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-800 before:via-slate-800 before:to-transparent pt-4 pb-20">
            {quest.encounters.length === 0 ? (
                <p className="text-center text-slate-400 italic mt-8">No encounters have been added to this quest yet.</p>
            ) : (
                <div className="space-y-8">
                    {quest.encounters.map((encounter: EncounterWithRelations) => {
                        const isExpanded = expandedId === encounter.id;
                        const selectedChampId = selections[encounter.id];
                        const selectedRosterItem = selectedChampId ? roster.find(r => r.championId === selectedChampId) : null;
                        const hasSelection = !!selectedChampId;

                        return (
                            <div key={encounter.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                {/* Timeline Dot (Sequence / Status) */}
                                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 transform -translate-x-1/2 font-bold z-10 transition-colors ${hasSelection ? "bg-sky-600 border-sky-400 text-white" : "bg-slate-900 border-slate-700 text-slate-300"
                                    }`}>
                                    {hasSelection ? <CheckCircle2 className="h-6 w-6" /> : encounter.sequence}
                                </div>

                                {/* Card Content */}
                                <Card
                                    className={`w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] ml-16 md:ml-0 bg-slate-950/90 backdrop-blur-sm border transition-all cursor-pointer overflow-hidden ${hasSelection ? "border-sky-800 shadow-[0_0_15px_rgba(2,132,199,0.15)]" : "border-slate-800 hover:border-slate-700"
                                        }`}
                                >
                                    {/* Card Header (Always Visible) */}
                                    <div
                                        className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
                                        onClick={() => toggleExpand(encounter.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Defender Avatar */}
                                            <div className="h-16 w-16 rounded-md bg-slate-900 border border-slate-800 overflow-hidden shrink-0 relative">
                                                {encounter.defender ? (
                                                    <Image
                                                        // @ts-ignore
                                                        src={encounter.defender.images?.avatar || '/placeholder'}
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

                                            <div>
                                                <CardTitle className="text-xl">{encounter.defender?.name || "Unknown Defender"}</CardTitle>
                                                {/* Mini node preview */}
                                                {encounter.nodes.length > 0 && !isExpanded && (
                                                    <div className="flex gap-1 mt-2 flex-wrap">
                                                        {encounter.nodes.slice(0, 3).map((n: EncounterNodeWithRelations) => (
                                                            <Badge key={n.id} variant="secondary" className="text-xs py-0 h-5 bg-slate-900 border-slate-800 text-slate-400">
                                                                {n.nodeModifier.name}
                                                            </Badge>
                                                        ))}
                                                        {encounter.nodes.length > 3 && <span className="text-xs text-slate-500">+{encounter.nodes.length - 3}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                                            {/* Selected Counter Preview */}
                                            {hasSelection && selectedRosterItem ? (
                                                <div className="flex items-center gap-2 bg-sky-950/30 px-3 py-1.5 rounded-full border border-sky-900/50">
                                                    <div className="h-8 w-8 rounded-full overflow-hidden relative shrink-0">
                                                        <Image
                                                            // @ts-ignore
                                                            src={selectedRosterItem.champion.images?.avatar || '/placeholder'}
                                                            alt={selectedRosterItem.champion.name}
                                                            fill
                                                            sizes="32px"
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                    <div className="hidden sm:block">
                                                        <div className="text-sm font-semibold text-sky-100">{selectedRosterItem.champion.name}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm font-medium text-slate-500 italic">No counter selected</div>
                                            )}

                                            <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-slate-800">
                                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-800 bg-slate-900/20 p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">

                                            {/* Nodes & Tips Grid */}
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                                {/* Nodes */}
                                                {encounter.nodes.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-semibold text-sky-400 uppercase tracking-wider">Node Buffs</h4>
                                                        <div className="space-y-2">
                                                            {encounter.nodes.map((n: EncounterNodeWithRelations) => (
                                                                <div key={n.id} className="bg-slate-900/50 p-2 rounded-md border border-slate-800/80">
                                                                    <span className="font-medium text-slate-200 block md:inline md:mr-2">{n.nodeModifier.name}</span>
                                                                    <span className="text-sm text-slate-400">{n.nodeModifier.description}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Tips */}
                                                {encounter.tips && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Quick Tips</h4>
                                                        <div className="bg-indigo-950/10 p-4 rounded-md border border-indigo-900/30 text-indigo-100 text-sm leading-relaxed whitespace-pre-wrap">
                                                            {encounter.tips}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Roster Selection */}
                                            <div className="space-y-3 pt-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider">Select Your Counter</h4>

                                                    {/* Recommendations hints */}
                                                    {(encounter.recommendedTags.length > 0 || encounter.recommendedChampions.length > 0) && (
                                                        <div className="flex gap-2">
                                                            {encounter.recommendedTags.map((tag: string) => (
                                                                <Badge key={tag} variant="outline" className="text-xs bg-amber-950/20 border-amber-900/50 text-amber-400">{tag}</Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {roster.length === 0 ? (
                                                    <div className="p-4 text-center border border-dashed border-slate-800 rounded-lg">
                                                        <p className="text-slate-400">Your roster is empty. Go add some champions!</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                                                        {roster.filter(r => {
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
                                                        }).slice(0, 30).map((r: RosterWithChampion) => {
                                                            const isSelected = selections[encounter.id] === r.championId;
                                                            const isRecommended = encounter.recommendedChampions.some((rc: Champion) => rc.id === r.championId);

                                                            return (
                                                                <div
                                                                    key={r.id}
                                                                    onClick={() => handleSelectCounter(encounter.id, r.championId)}
                                                                    className={`relative shrink-0 w-20 flex flex-col items-center gap-1 cursor-pointer transition-transform snap-start select-none ${isSelected ? "scale-105" : "hover:scale-105 opacity-80 hover:opacity-100"
                                                                        }`}
                                                                >
                                                                    <div className={`w-16 h-16 rounded-lg overflow-hidden relative border-2 ${isSelected ? "border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                                                                        : isRecommended ? "border-amber-500"
                                                                            : "border-slate-800"
                                                                        }`}>
                                                                        <Image
                                                                            // @ts-ignore
                                                                            src={r.champion.images?.avatar || '/placeholder'}
                                                                            alt={r.champion.name}
                                                                            fill
                                                                            sizes="64px"
                                                                            className="object-cover"
                                                                        />
                                                                        {isSelected && (
                                                                            <div className="absolute inset-0 bg-sky-500/20 flex items-center justify-center">
                                                                                <CheckCircle2 className="text-white h-6 w-6 drop-shadow-md" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-[10px] text-center leading-tight font-medium px-1 w-full truncate ${isSelected ? "text-sky-300" : "text-slate-400"}`}>
                                                                        {r.champion.shortName || r.champion.name}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
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
    );
}
