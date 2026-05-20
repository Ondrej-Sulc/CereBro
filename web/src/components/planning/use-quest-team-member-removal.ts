"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { savePlayerQuestCounter, savePlayerQuestPrefightChampion, savePlayerQuestSynergy } from "@/app/actions/player-quest-progress";
import { reportClientError } from "@/lib/observability/client";
import type { QuestPlanningSelectionMap, QuestPlanningTeamMember } from "@/lib/quest-planning-projection";
import {
    applyQuestTimelineTeamMemberRemoval,
    decideQuestTimelineTeamMemberRemoval,
    type QuestTimelineTeamMemberRemovalTarget,
} from "./quest-timeline-controller";
import type { EncounterWithRelations, QuestTimelineProps, RosterWithChampion } from "./types";

type Toast = (input: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
}) => void;

type PendingRemoval = QuestTimelineTeamMemberRemovalTarget & { championName: string };

export function useQuestTeamMemberRemoval({
    quest,
    selectedTeamMembers,
    synergyIds,
    setSelections,
    setPrefightSelections,
    setSynergyIds,
    toast,
}: {
    quest: QuestTimelineProps["quest"];
    selectedTeamMembers: QuestPlanningTeamMember<RosterWithChampion, EncounterWithRelations>[];
    synergyIds: number[];
    setSelections: Dispatch<SetStateAction<QuestPlanningSelectionMap>>;
    setPrefightSelections: Dispatch<SetStateAction<QuestPlanningSelectionMap>>;
    setSynergyIds: Dispatch<SetStateAction<number[]>>;
    toast: Toast;
}) {
    const [championToRemove, setChampionToRemove] = useState<PendingRemoval | null>(null);

    const removeTeamMember = async (target: QuestTimelineTeamMemberRemovalTarget) => {
        const { championId, assignedEncounters, assignedPrefights, isSynergy } = target;

        try {
            const promises: Promise<unknown>[] = [];

            if (isSynergy) {
                promises.push(savePlayerQuestSynergy(quest.id, championId, true));
            }

            assignedEncounters.forEach(encounterId => {
                promises.push(savePlayerQuestCounter(quest.id, encounterId, null));
            });
            assignedPrefights.forEach(encounterId => {
                promises.push(savePlayerQuestPrefightChampion(quest.id, encounterId, null));
            });

            await Promise.all(promises);

            setSelections(prev => applyQuestTimelineTeamMemberRemoval({
                target,
                selections: prev,
                prefightSelections: {},
                synergyIds: [],
            }).selections);
            setPrefightSelections(prev => applyQuestTimelineTeamMemberRemoval({
                target,
                selections: {},
                prefightSelections: prev,
                synergyIds: [],
            }).prefightSelections);
            setSynergyIds(prev => applyQuestTimelineTeamMemberRemoval({
                target,
                selections: {},
                prefightSelections: {},
                synergyIds: prev,
            }).synergyIds);

            if (assignedEncounters.length > 0 || assignedPrefights.length > 0) {
                toast({ title: "Assignments Cleared", description: "Champion has been unassigned from fights and prefights." });
            } else if (isSynergy) {
                toast({ title: "Synergy Removed", description: "Champion has been removed from synergy." });
            }
        } catch (error) {
            reportClientError("quest_timeline_remove_team_member", error, { quest_id: quest.id });
            toast({ title: "Error", description: "Failed to remove champion completely. Some operations may have failed.", variant: "destructive" });
        }
    };

    const executeRemoveTeamMember = async () => {
        if (!championToRemove) return;
        await removeTeamMember(championToRemove);
        setChampionToRemove(null);
    };

    const initiateRemoveTeamMember = (rosterId: string, championId: number, championName: string) => {
        const decision = decideQuestTimelineTeamMemberRemoval({
            rosterId,
            championId,
            championName,
            teamLimit: quest.teamLimit,
            selectedTeamMembers,
            synergyIds,
        });
        if (decision.kind === "ignored") return;
        if (decision.kind === "confirm") {
            setChampionToRemove({ ...decision.target, championName });
        } else {
            removeTeamMember(decision.target);
        }
    };

    return {
        championToRemove,
        setChampionToRemove,
        initiateRemoveTeamMember,
        executeRemoveTeamMember,
    };
}
