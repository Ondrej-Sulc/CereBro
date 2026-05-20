"use client";

import Image from "next/image";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PickCounterWithChampion } from "@/app/actions/quest-catalog";
import { UpdatedChampionItem } from "@/components/UpdatedChampionItem";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import type { QuestPlanningSelectionMap } from "@/lib/quest-planning-projection";
import type { ChampionClass } from "@prisma/client";
import type { Champion } from "@/types/champion";
import { MultiPlayerPopover, PlayerTeamSummary } from "./player-team-popover";
import type { PlayerPicksMap } from "./quest-timeline-view-model";
import type { EncounterWithRelations, QuestTimelineProps, RosterWithChampion } from "./types";
import { toChampionImages } from "./types";
import {
    isChampionValidForEncounterOrQuest,
    isQuestRosterEntryUnavailableForEncounter,
} from "./utils";

type QuestPickRendererContext = {
    quest: QuestTimelineProps["quest"];
    activeQuest: QuestTimelineProps["quest"];
    roster: RosterWithChampion[];
    readOnly: boolean;
    selections: QuestPlanningSelectionMap;
    activeSelections: QuestPlanningSelectionMap;
    activeEncounterIds: Set<string>;
    activePlayerPicksMap: PlayerPicksMap;
    handleSelectCounter: (encounterId: string, rosterId: string) => void;
    scrollToEncounter: (encounterId: string) => void;
};

export function createQuestTimelinePickRenderers({
    quest,
    activeQuest,
    roster,
    readOnly,
    selections,
    activeSelections,
    activeEncounterIds,
    activePlayerPicksMap,
    handleSelectCounter,
    scrollToEncounter,
}: QuestPickRendererContext) {
    const renderChampionItem = (
        champion: Champion,
        encounter: EncounterWithRelations,
        popularityLabel?: string,
        isRecommendedTab?: boolean,
        isCompact?: boolean
    ) => {
        if (readOnly) {
            return (
                <UpdatedChampionItem
                    item={{
                        stars: 0,
                        rank: 0,
                        champion: {
                            id: champion.id,
                            name: champion.shortName || champion.name,
                            championClass: champion.class,
                            images: toChampionImages(champion.images),
                        },
                    }}
                    isRecommended
                    popularityLabel={popularityLabel}
                />
            );
        }

        const validRosterEntries = roster
            .filter(entry => entry.championId === champion.id && isChampionValidForEncounterOrQuest(entry, quest, encounter))
            .sort((a, b) => {
                if (a.isUnowned !== b.isUnowned) return a.isUnowned ? 1 : -1;
                return b.stars - a.stars || b.rank - a.rank;
            });

        const userChamp = validRosterEntries.find(entry =>
            !Object.values(activeSelections).includes(entry.id) ||
            selections[encounter.id] === entry.id
        ) || validRosterEntries[0];
        const isMissing = !userChamp || userChamp.isUnowned;
        const isSelected = !!userChamp && selections[encounter.id] === userChamp.id;
        const isChampInTeam = quest.teamLimit !== null && Object.values(activeSelections).some(rosterId => {
            if (!rosterId) return false;
            return roster.find(entry => entry.id === rosterId)?.championId === champion.id;
        });

        const isUnavailable = isQuestRosterEntryUnavailableForEncounter({
            entry: userChamp,
            encounterId: encounter.id,
            selections,
            activeEncounterIds,
            roster,
            quest,
            encounter,
        });

        return (
            <div
                onClick={(event) => {
                    event.stopPropagation();
                    if (userChamp && !userChamp.isUnowned && !isUnavailable) {
                        handleSelectCounter(encounter.id, userChamp.id);
                    }
                }}
                className={cn(
                    "flex flex-col gap-1.5",
                    (isUnavailable || isMissing) ? "cursor-not-allowed" : "cursor-pointer group"
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
                                images: toChampionImages(userChamp.champion.images),
                            },
                            isAscended: userChamp.isAscended,
                            ascensionLevel: userChamp.ascensionLevel,
                        } : {
                            stars: 0,
                            rank: 0,
                            champion: {
                                id: champion.id,
                                name: champion.shortName || champion.name,
                                championClass: champion.class,
                                images: toChampionImages(champion.images),
                            },
                        }}
                        isSelected={isSelected}
                        isRecommended={!isSelected && isRecommendedTab}
                        isMissing={isMissing}
                        isInTeam={isChampInTeam}
                        isUnavailable={isUnavailable}
                        popularityLabel={!isCompact ? popularityLabel : undefined}
                    />
                </div>
            </div>
        );
    };

    const renderListPick = (pick: PickCounterWithChampion, encounter: EncounterWithRelations) => {
        const validRosterEntries = roster
            .filter(entry => entry.championId === pick.championId && isChampionValidForEncounterOrQuest(entry, quest, encounter))
            .sort((a, b) => {
                if (a.isUnowned !== b.isUnowned) return a.isUnowned ? 1 : -1;
                return b.stars - a.stars || b.rank - a.rank;
            });
        const userChamp = validRosterEntries.find(entry =>
            !Object.values(activeSelections).includes(entry.id) ||
            selections[encounter.id] === entry.id
        ) || validRosterEntries[0];
        const isMissing = !userChamp || userChamp.isUnowned;
        const isSelected = !!userChamp && selections[encounter.id] === userChamp.id;
        const isInTeam = quest.teamLimit !== null && Object.values(activeSelections).some(rosterId =>
            rosterId !== null && roster.find(entry => entry.id === rosterId)?.championId === pick.championId
        );

        const isUnavailable = isQuestRosterEntryUnavailableForEncounter({
            entry: userChamp,
            encounterId: encounter.id,
            selections,
            activeEncounterIds,
            roster,
            quest,
            encounter,
        });

        const users = pick.pickedBy || [];
        const maxSidebarUsers = 3;
        const displayUsers = users.slice(0, maxSidebarUsers);
        const hasMore = users.length > maxSidebarUsers;
        const classColors = getChampionClassColors(pick.champion.class as ChampionClass);

        return (
            <div
                key={pick.championId}
                className={cn(
                    "flex overflow-hidden rounded-2xl border bg-slate-900/40 shadow-lg transition-all duration-300 group/pick-card",
                    isUnavailable ? "cursor-not-allowed border-red-950/40 bg-red-950/5 opacity-80" : isMissing ? "cursor-not-allowed border-slate-800/80 bg-slate-900/40 shadow-xl backdrop-blur-md" : "cursor-pointer bg-slate-900/40 shadow-xl backdrop-blur-md",
                    !isUnavailable && isSelected && "border-sky-500/60 bg-sky-950/20 shadow-sky-500/10 ring-1 ring-sky-500/30",
                    !isUnavailable && isInTeam && !isSelected && "border-emerald-500/40 bg-emerald-950/10 shadow-emerald-500/10",
                    !isUnavailable && !isSelected && !isInTeam && cn("border-slate-800/80 hover:border-slate-600 hover:bg-slate-800/60", classColors.hoverBorder)
                )}
                onClick={(event) => {
                    event.stopPropagation();
                    if (userChamp && !userChamp.isUnowned && !isUnavailable) {
                        handleSelectCounter(encounter.id, userChamp.id);
                    }
                }}
            >
                <div className="min-w-0 flex-1">
                    <div className="rounded-none border-0 bg-transparent shadow-none ring-0">
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
                                    images: toChampionImages(userChamp.champion.images),
                                },
                                isAscended: userChamp.isAscended,
                                ascensionLevel: userChamp.ascensionLevel,
                            } : {
                                stars: 0,
                                rank: 0,
                                champion: {
                                    id: pick.championId,
                                    name: pick.champion.name,
                                    championClass: pick.champion.class as ChampionClass,
                                    images: toChampionImages(pick.champion.images),
                                },
                            }}
                            isSelected={false}
                            isRecommended={false}
                            isMissing={isMissing}
                            isInTeam={false}
                            isUnavailable={false}
                        />
                    </div>
                </div>

                <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-2.5 border-l border-slate-800/60 bg-slate-950/40 p-1">
                    {users.length > 0 && (
                        <>
                            {displayUsers.map((user) => (
                                <Popover key={user.id}>
                                    <PopoverTrigger asChild>
                                        <div
                                            className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-slate-700 bg-slate-800 shadow-lg transition-all hover:scale-110 hover:border-sky-500/50 group/user"
                                            onClick={(event) => event.stopPropagation()}
                                            title={`Suggested by ${user.name} - Click to see their plan`}
                                        >
                                            {user.avatar ? (
                                                <Image src={user.avatar} alt={user.name} fill className="object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                                                    {user.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="z-[100] w-[90vw] overflow-hidden rounded-2xl border-slate-800 bg-slate-950/95 p-0 shadow-2xl backdrop-blur-xl sm:w-[450px]"
                                        align="end"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <PlayerTeamSummary
                                            user={user}
                                            picks={activePlayerPicksMap[user.id]?.picks || []}
                                            quest={activeQuest}
                                            scrollToEncounter={scrollToEncounter}
                                        />
                                    </PopoverContent>
                                </Popover>
                            ))}

                            {hasMore && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <div
                                            className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 shadow-lg transition-all hover:scale-110 hover:border-sky-500/50 active:scale-95 group/more-users"
                                            onClick={(event) => event.stopPropagation()}
                                            title={`Suggested by ${users.length} players - Click to see list`}
                                        >
                                            <span className="text-[10px] font-black text-sky-400">+{users.length - maxSidebarUsers}</span>
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="z-[100] w-[280px] overflow-hidden rounded-2xl border-slate-800 bg-slate-950/95 p-0 shadow-2xl backdrop-blur-xl"
                                        align="end"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <MultiPlayerPopover
                                            users={users}
                                            quest={activeQuest}
                                            scrollToEncounter={scrollToEncounter}
                                            playerPicksMap={activePlayerPicksMap}
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

    return { renderChampionItem, renderListPick };
}
