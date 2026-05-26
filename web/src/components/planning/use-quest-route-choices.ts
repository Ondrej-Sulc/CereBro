"use client";

import { useState } from "react";
import { savePlayerQuestRouteChoice } from "@/app/actions/player-quest-progress";
import { createInitialQuestRouteChoices } from "@/lib/quest-planning-projection";
import { getLockedQuestObjectiveRouteChoices, mergeQuestObjectiveRouteChoices } from "@/lib/quest-objectives";
import type { QuestTimelineProps } from "./types";

type Toast = (input: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
}) => void;

export function useQuestRouteChoices({
    quest,
    savedRouteChoices,
    readOnly,
    objectiveSlug,
    activeObjective,
    toast,
}: {
    quest: QuestTimelineProps["quest"];
    savedRouteChoices: NonNullable<QuestTimelineProps["savedRouteChoices"]>;
    readOnly: boolean;
    objectiveSlug?: string | null;
    activeObjective?: QuestTimelineProps["activeObjective"];
    toast: Toast;
}) {
    const [routeChoices, setRouteChoices] = useState<Record<string, string>>(() =>
        mergeQuestObjectiveRouteChoices(
            createInitialQuestRouteChoices({
                routeSections: quest.routeSections,
                savedRouteChoices,
            }),
            activeObjective
        )
    );
    const lockedRouteChoices = getLockedQuestObjectiveRouteChoices(activeObjective);

    const handleRouteChoice = async (sectionId: string, pathId: string) => {
        const previous = routeChoices[sectionId];
        const lockedPathId = lockedRouteChoices.get(sectionId);
        if (lockedPathId && lockedPathId !== pathId) {
            toast({ title: "Route Locked", description: "This route is required by the selected objective.", variant: "destructive" });
            return;
        }
        if (readOnly || previous === pathId) return;
        setRouteChoices(prev => ({ ...prev, [sectionId]: pathId }));
        try {
            await savePlayerQuestRouteChoice(quest.id, sectionId, pathId, objectiveSlug);
        } catch (error: unknown) {
            setRouteChoices(prev => ({ ...prev, [sectionId]: previous }));
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to save route choice";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    return {
        routeChoices,
        lockedRouteChoices,
        handleRouteChoice,
    };
}
