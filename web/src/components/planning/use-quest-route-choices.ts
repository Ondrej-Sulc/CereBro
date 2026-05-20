"use client";

import { useState } from "react";
import { savePlayerQuestRouteChoice } from "@/app/actions/player-quest-progress";
import { createInitialQuestRouteChoices } from "@/lib/quest-planning-projection";
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
    toast,
}: {
    quest: QuestTimelineProps["quest"];
    savedRouteChoices: NonNullable<QuestTimelineProps["savedRouteChoices"]>;
    readOnly: boolean;
    toast: Toast;
}) {
    const [routeChoices, setRouteChoices] = useState<Record<string, string>>(() =>
        createInitialQuestRouteChoices({
            routeSections: quest.routeSections,
            savedRouteChoices,
        })
    );

    const handleRouteChoice = async (sectionId: string, pathId: string) => {
        const previous = routeChoices[sectionId];
        if (readOnly || previous === pathId) return;
        setRouteChoices(prev => ({ ...prev, [sectionId]: pathId }));
        try {
            await savePlayerQuestRouteChoice(quest.id, sectionId, pathId);
        } catch (error: unknown) {
            setRouteChoices(prev => ({ ...prev, [sectionId]: previous }));
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to save route choice";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    return {
        routeChoices,
        handleRouteChoice,
    };
}
