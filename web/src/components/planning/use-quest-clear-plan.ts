"use client";

import type { Dispatch, SetStateAction } from "react";
import { clearAllQuestCounters } from "@/app/actions/player-quest-progress";
import type { QuestPlanningSelectionMap } from "@/lib/quest-planning-projection";
import {
    clearQuestTimelinePlanSelections,
} from "./quest-timeline-controller";

type Toast = (input: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
}) => void;

export function useQuestClearPlan({
    questId,
    setSelections,
    setPrefightSelections,
    toast,
}: {
    questId: string;
    setSelections: Dispatch<SetStateAction<QuestPlanningSelectionMap>>;
    setPrefightSelections: Dispatch<SetStateAction<QuestPlanningSelectionMap>>;
    toast: Toast;
}) {
    const executeClearPlan = async () => {
        try {
            await clearAllQuestCounters(questId);
            const nextState = clearQuestTimelinePlanSelections();
            setSelections(nextState.selections);
            setPrefightSelections(nextState.prefightSelections);
            toast({ title: "Plan Cleared", description: "All counter and prefight selections have been removed. Revive counts were kept." });
        } catch {
            toast({ title: "Error", description: "Failed to clear the plan.", variant: "destructive" });
        }
    };

    return {
        executeClearPlan,
    };
}
