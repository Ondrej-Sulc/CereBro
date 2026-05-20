"use client";

import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EncounterWithRelations, QuestWithRelations } from "../types";

export function EncounterRestrictions({
    quest,
    encounter,
}: {
    quest: QuestWithRelations;
    encounter: EncounterWithRelations;
}) {
    const restrictions = [
        quest.minStarLevel ? `Min ${quest.minStarLevel}★ (Quest)` : null,
        quest.maxStarLevel ? `Max ${quest.maxStarLevel}★ (Quest)` : null,
        quest.requiredClasses?.length ? `Class: ${quest.requiredClasses.join(", ")} (Quest)` : null,
        encounter.minStarLevel ? `Min ${encounter.minStarLevel}★ (Encounter)` : null,
        encounter.maxStarLevel ? `Max ${encounter.maxStarLevel}★ (Encounter)` : null,
        encounter.requiredClasses?.length ? `Class: ${encounter.requiredClasses.join(", ")} (Encounter)` : null,
        quest.requiredTags?.length ? `Quest Tags: ${quest.requiredTags.map((tag) => tag.name).join(", ")}` : null,
        encounter.requiredTags?.length ? `Fight Tags: ${encounter.requiredTags.map((tag) => tag.name).join(", ")}` : null,
    ].filter(Boolean);

    if (restrictions.length === 0) return null;

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-2.5 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-red-400">
                <AlertCircle className="h-4 w-4" /> Restrictions
            </div>
            <div className="flex flex-wrap gap-1.5">
                {restrictions.map((restriction, index) => (
                    <Badge key={index} variant="outline" className="h-5 border-red-800/60 bg-red-950/40 py-0 text-[10px] text-red-200">{restriction}</Badge>
                ))}
            </div>
        </div>
    );
}
