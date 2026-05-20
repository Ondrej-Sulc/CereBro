"use client";

import { EncounterCard, type EncounterCardProps } from "./encounter-card/EncounterCard";
import type { QuestPlanningReviveMap } from "@/lib/quest-planning-projection";
import type { EncounterWithRelations } from "./types";

type Difficulty = "EASY" | "NORMAL" | "HARD";

type QuestEncounterListProps = Omit<EncounterCardProps, "encounter" | "index" | "revivesUsed"> & {
    encounters: EncounterWithRelations[];
    allEncounters: EncounterWithRelations[];
    difficultyFilter: Difficulty[];
    revivesByEncounterId: QuestPlanningReviveMap;
};

export function QuestEncounterList({
    encounters,
    allEncounters,
    difficultyFilter,
    revivesByEncounterId,
    ...encounterCardProps
}: QuestEncounterListProps) {
    if (encounters.length === 0) {
        return (
            <p className="mt-8 pl-6 text-center text-sm italic text-slate-500 md:pl-10">
                No {difficultyFilter.map(difficulty => difficulty.toLowerCase()).join(" or ")} fights in this quest.
            </p>
        );
    }

    return (
        <>
            {encounters.map((encounter) => (
                <EncounterCard
                    key={encounter.id}
                    encounter={encounter}
                    index={allEncounters.findIndex(item => item.id === encounter.id)}
                    revivesUsed={revivesByEncounterId[encounter.id] || 0}
                    {...encounterCardProps}
                />
            ))}
        </>
    );
}
