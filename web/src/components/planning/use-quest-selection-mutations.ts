"use client";

import type { Dispatch, SetStateAction } from "react";
import { savePlayerQuestCounter, savePlayerQuestPrefightChampion } from "@/app/actions/player-quest-progress";
import { reportClientError } from "@/lib/observability/client";
import type { QuestSelectionAssignment, QuestSelectionSynergy } from "@/lib/player-quest-selection";
import type { QuestPlanningSelectionMap } from "@/lib/quest-planning-projection";
import {
    decideQuestTimelineCounterSelection,
    decideQuestTimelinePrefightSelection,
} from "./quest-timeline-controller";
import type { QuestTimelineProps, RosterWithChampion } from "./types";

type Toast = (input: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
}) => void;

export function useQuestSelectionMutations({
    quest,
    roster,
    readOnly,
    selections,
    prefightSelections,
    activeQuestAssignments,
    activeSynergyChampions,
    objectiveSlug,
    setSelections,
    setPrefightSelections,
    closeEncounterAfterSelection,
    toast,
}: {
    quest: QuestTimelineProps["quest"];
    roster: RosterWithChampion[];
    readOnly: boolean;
    selections: QuestPlanningSelectionMap;
    prefightSelections: QuestPlanningSelectionMap;
    activeQuestAssignments: QuestSelectionAssignment[];
    activeSynergyChampions: QuestSelectionSynergy[];
    objectiveSlug?: string | null;
    setSelections: Dispatch<SetStateAction<QuestPlanningSelectionMap>>;
    setPrefightSelections: Dispatch<SetStateAction<QuestPlanningSelectionMap>>;
    closeEncounterAfterSelection: (encounterId: string) => void;
    toast: Toast;
}) {
    const handleSelectCounter = async (encounterId: string, rosterId: string) => {
        if (readOnly) return;

        const decision = decideQuestTimelineCounterSelection({
            quest,
            encounterId,
            rosterId,
            roster,
            selections,
            prefightSelections,
            activeQuestAssignments,
            activeSynergyChampions,
        });
        if (decision.kind === "ignored") return;
        if (decision.kind === "rejected") {
            toast({ title: decision.title, description: decision.description, variant: "destructive" });
            return;
        }

        setSelections(prev => ({ ...prev, [encounterId]: decision.nextRosterId }));
        if (decision.shouldClearPrefight) {
            setPrefightSelections(prev => ({ ...prev, [encounterId]: null }));
        }

        if (decision.nextRosterId !== null) {
            closeEncounterAfterSelection(encounterId);
        }

        try {
            await savePlayerQuestCounter(quest.id, encounterId, decision.nextChampionId, decision.nextChampionStars, objectiveSlug);
        } catch (error) {
            reportClientError("quest_timeline_save_counter", error, {
                quest_id: quest.id,
                encounter_id: encounterId,
            });
            setSelections(prev => ({ ...prev, [encounterId]: decision.previousRosterId }));
            if (decision.shouldClearPrefight) {
                setPrefightSelections(prev => ({ ...prev, [encounterId]: decision.previousPrefightRosterId ?? null }));
            }
            toast({ title: "Error", description: "Failed to save selection.", variant: "destructive" });
        }
    };

    const handleSelectPrefight = async (encounterId: string, rosterId: string) => {
        if (readOnly) return;

        const decision = decideQuestTimelinePrefightSelection({
            quest,
            encounterId,
            rosterId,
            roster,
            selections,
            prefightSelections,
            activeQuestAssignments,
            activeSynergyChampions,
        });
        if (decision.kind === "ignored") return;
        if (decision.kind === "rejected") {
            toast({ title: decision.title, description: decision.description, variant: "destructive" });
            return;
        }

        setPrefightSelections(prev => ({ ...prev, [encounterId]: decision.nextRosterId }));

        try {
            await savePlayerQuestPrefightChampion(quest.id, encounterId, decision.nextChampionId, decision.nextChampionStars, objectiveSlug);
        } catch (error) {
            reportClientError("quest_timeline_save_prefight", error, {
                quest_id: quest.id,
                encounter_id: encounterId,
            });
            setPrefightSelections(prev => ({ ...prev, [encounterId]: decision.previousRosterId }));
            const msg = error instanceof Error ? error.message : "Failed to save prefight.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    return {
        handleSelectCounter,
        handleSelectPrefight,
    };
}
