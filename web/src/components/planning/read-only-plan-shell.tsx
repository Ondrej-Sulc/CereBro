import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import QuestTimelineClient from "@/components/planning/quest-timeline-client";
import { ChampionImages } from "@/types/champion";
import { RosterWithChampion, SynergyWithChampion, type QuestTimelineProps } from "./types";

type ReadOnlyChampionLink = {
    ability: {
        id: number;
        name: string;
    };
};

type ReadOnlyChampion = {
    images: unknown;
    tags?: unknown[];
    abilities?: ReadOnlyChampionLink[];
};

type ReadOnlyRosterEntry = {
    champion: ReadOnlyChampion;
};

type ReadOnlySynergyChampion = {
    champion: ReadOnlyChampion;
};

type ReadOnlyPlan = {
    encounters: {
        questEncounterId: string;
        selectedChampionId: number | null;
        prefightChampionId: number | null;
    }[];
    rosterEntries?: ReadOnlyRosterEntry[];
    synergyChampions?: ReadOnlySynergyChampion[];
    rosterMap?: Record<string, unknown>;
    routeChoices?: unknown[];
};

type ReadOnlyQuest = {
    title: string;
    bannerUrl?: string | null;
    bannerFit?: string | null;
    bannerPosition?: string | null;
    category?: { name: string } | null;
};

type ReadOnlyPlayer = {
    avatar?: string | null;
    ingameName: string;
};

interface ReadOnlyPlanShellProps {
    plan: ReadOnlyPlan;
    quest: ReadOnlyQuest;
    player: ReadOnlyPlayer;
    backLinkHref: string;
    backLinkText: string;
    subtitle: string;
    attributionHref?: string;
}

export function ReadOnlyPlanShell({
    plan,
    quest,
    player,
    backLinkHref,
    backLinkText,
    subtitle,
    attributionHref
}: ReadOnlyPlanShellProps) {
    // Build selections map: encounterId -> championId
    const selections: Record<string, number | null> = {};
    const prefightSelections: Record<string, number | null> = {};
    for (const encounter of plan.encounters) {
        selections[encounter.questEncounterId] = encounter.selectedChampionId;
        prefightSelections[encounter.questEncounterId] = encounter.prefightChampionId;
    }

    const attributionContent = (
        <>
            <Avatar className="h-8 w-8 border border-slate-700">
                <AvatarImage src={player.avatar || undefined} />
                <AvatarFallback className="text-xs bg-slate-800">{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
                <p className="text-sm font-semibold text-slate-200">{player.ingameName}&apos;s Plan</p>
                <p className="text-[10px] text-slate-500">{subtitle}</p>
            </div>
        </>
    );

    // Map roster entries to typed objects for the team summary
    const roster = (plan.rosterEntries || []).map((entry) => ({
        ...entry,
        champion: {
            ...entry.champion,
            images: entry.champion.images as unknown as ChampionImages,
            tags: entry.champion.tags || [],
            abilities: (entry.champion.abilities || []).map((link) => ({
                ...link,
                ability: {
                    id: link.ability.id,
                    name: link.ability.name,
                    categories: []
                }
            }))
        }
    })) as unknown as RosterWithChampion[];

    // Map synergy champions for correct typing
    const savedSynergies = (plan.synergyChampions || []).map((s) => ({
        ...s,
        champion: {
            ...s.champion,
            images: s.champion.images as unknown as ChampionImages,
            tags: s.champion.tags || [],
            abilities: (s.champion.abilities || []).map((link) => ({
                ...link,
                ability: {
                    id: link.ability.id,
                    name: link.ability.name,
                    categories: []
                }
            }))
        }
    })) as unknown as SynergyWithChampion[];

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header with back link */}
            <div className="mb-6">
                <Link href={backLinkHref} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4">
                    <ChevronLeft className="w-3.5 h-3.5" /> {backLinkText}
                </Link>

                {/* Quest Banner */}
                {quest.bannerUrl ? (
                    <div className="relative rounded-xl overflow-hidden h-48 md:h-64 mb-6 border border-slate-800">
                        <Image
                            src={quest.bannerUrl.replace(/#/g, '%23')}
                            alt={quest.title}
                            fill
                            className="object-cover"
                            style={{
                                objectFit: (quest.bannerFit as "cover" | "contain") || "cover",
                                objectPosition: quest.bannerPosition || "center"
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
                            {quest.category && (
                                <Badge variant="outline" className="bg-sky-950/60 border-sky-800/50 text-sky-300 text-[10px] uppercase font-bold tracking-wider mb-2">
                                    {quest.category.name}
                                </Badge>
                            )}
                            <h1 className="text-2xl md:text-4xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                {quest.title}
                            </h1>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6">
                        {quest.category && (
                            <Badge variant="outline" className="bg-sky-950/60 border-sky-800/50 text-sky-300 text-[10px] uppercase font-bold tracking-wider mb-2">
                                {quest.category.name}
                            </Badge>
                        )}
                        <h1 className="text-2xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">
                            {quest.title}
                        </h1>
                    </div>
                )}

                {/* Player attribution */}
                {attributionHref ? (
                    <Link href={attributionHref} className="inline-flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-sky-800/50 transition-colors">
                        {attributionContent}
                    </Link>
                ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg w-fit">
                        {attributionContent}
                    </div>
                )}
            </div>

            {/* Read-only Timeline */}
            <QuestTimelineClient
                quest={quest as unknown as QuestTimelineProps["quest"]}
                roster={roster}
                savedEncounters={plan.encounters as unknown as NonNullable<QuestTimelineProps["savedEncounters"]>}
                readOnly
                initialSelections={selections}
                initialPrefightSelections={prefightSelections}
                rosterMap={plan.rosterMap}
                savedRouteChoices={(plan.routeChoices || []) as unknown as NonNullable<QuestTimelineProps["savedRouteChoices"]>}
                savedSynergies={savedSynergies}
            />
        </div>
    );
}
