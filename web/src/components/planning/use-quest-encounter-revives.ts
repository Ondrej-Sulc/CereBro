"use client";

import { useState } from "react";
import { savePlayerQuestEncounterRevives } from "@/app/actions/player-quest-progress";
import { reportClientError } from "@/lib/observability/client";
import {
    createInitialQuestTimelineRevives,
} from "./quest-timeline-view-model";
import {
    decideQuestTimelineRevives,
} from "./quest-timeline-controller";
import type { QuestTimelineProps } from "./types";

type Toast = (input: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
}) => void;

export function useQuestEncounterRevives({
    questId,
    savedEncounters,
    readOnly,
    toast,
}: {
    questId: string;
    savedEncounters: NonNullable<QuestTimelineProps["savedEncounters"]>;
    readOnly: boolean;
    toast: Toast;
}) {
    const [revivesByEncounterId, setRevivesByEncounterId] = useState<Record<string, number>>(() =>
        createInitialQuestTimelineRevives(savedEncounters)
    );

    const handleSetRevives = async (encounterId: string, revivesUsed: number) => {
        const decision = decideQuestTimelineRevives({
            readOnly,
            encounterId,
            revivesUsed,
            revivesByEncounterId,
        });
        if (decision.kind === "ignored") return;

        setRevivesByEncounterId(decision.nextRevivesByEncounterId);

        try {
            await savePlayerQuestEncounterRevives(questId, encounterId, decision.nextRevives);
        } catch (error) {
            reportClientError("quest_timeline_save_revives", error, {
                quest_id: questId,
                encounter_id: encounterId,
            });
            setRevivesByEncounterId(decision.rollbackRevivesByEncounterId);
            toast({ title: "Error", description: "Failed to save revive count.", variant: "destructive" });
        }
    };

    return {
        revivesByEncounterId,
        handleSetRevives,
    };
}
