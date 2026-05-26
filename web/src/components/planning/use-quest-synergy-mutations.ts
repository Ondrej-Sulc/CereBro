"use client";

import type { Dispatch, SetStateAction } from "react";
import { savePlayerQuestSynergy } from "@/app/actions/player-quest-progress";
import { reportClientError } from "@/lib/observability/client";
import type { QuestSelectionAssignment, QuestSelectionSynergy } from "@/lib/player-quest-selection";
import {
    decideQuestTimelineSynergy,
} from "./quest-timeline-controller";
import type { QuestTimelineProps } from "./types";

type Toast = (input: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
}) => void;

export function useQuestSynergyMutations({
    quest,
    synergyIds,
    activeQuestAssignments,
    activeSynergyChampions,
    objectiveSlug,
    setSynergyIds,
    toast,
}: {
    quest: QuestTimelineProps["quest"];
    synergyIds: number[];
    activeQuestAssignments: QuestSelectionAssignment[];
    activeSynergyChampions: QuestSelectionSynergy[];
    objectiveSlug?: string | null;
    setSynergyIds: Dispatch<SetStateAction<number[]>>;
    toast: Toast;
}) {
    const handleSelectSynergy = async (championId: number) => {
        const decision = decideQuestTimelineSynergy({
            quest,
            championId,
            synergyIds,
            activeQuestAssignments,
            activeSynergyChampions,
        });
        if (decision.kind === "ignored") return;
        if (decision.kind === "rejected") {
            toast({ title: decision.title, description: decision.description, variant: "destructive" });
            return;
        }

        setSynergyIds(decision.nextSynergyIds);

        try {
            await savePlayerQuestSynergy(quest.id, championId, decision.isRemoving, objectiveSlug);
        } catch (error) {
            reportClientError("quest_timeline_save_synergy", error, {
                quest_id: quest.id,
                champion_id: championId,
            });
            setSynergyIds(decision.rollbackSynergyIds);
            toast({ title: "Error", description: "Failed to save synergy.", variant: "destructive" });
        }
    };

    return {
        handleSelectSynergy,
    };
}
