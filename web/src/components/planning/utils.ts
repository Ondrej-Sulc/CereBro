import { RosterWithChampion, QuestWithRelations, EncounterWithRelations } from "./types";
import { Tag } from "@prisma/client";

export const isChampionValidForEncounterOrQuest = (
    r: RosterWithChampion,
    quest: QuestWithRelations,
    encounter: EncounterWithRelations | undefined
) => {
    // Quest-level restrictions
    if (quest.minStarLevel && r.stars < quest.minStarLevel) return false;
    if (quest.maxStarLevel && r.stars > quest.maxStarLevel) return false;
    if (quest.requiredClasses && quest.requiredClasses.length > 0 && !quest.requiredClasses.includes(r.champion.class)) return false;
    if (quest.requiredTags && quest.requiredTags.length > 0) {
        const hasTag = (quest.requiredTags as Tag[]).some((tag: Tag) => r.champion.tags?.some(ct => ct.id === tag.id));
        if (!hasTag) return false;
    }

    // Encounter-level restrictions
    if (encounter) {
        if (encounter.minStarLevel && r.stars < encounter.minStarLevel) return false;
        if (encounter.maxStarLevel && r.stars > encounter.maxStarLevel) return false;
        if (encounter.requiredClasses && encounter.requiredClasses.length > 0 && !encounter.requiredClasses.includes(r.champion.class)) return false;
        if (encounter.requiredTags && encounter.requiredTags.length > 0) {
            const hasTag = (encounter.requiredTags as Tag[]).some(tag => r.champion.tags?.some(ct => ct.id === tag.id));
            if (!hasTag) return false;
        }
    }

    return true;
};

export const getValidRosterCountForChampion = (
    championId: number,
    roster: RosterWithChampion[],
    quest: QuestWithRelations,
    encounter: EncounterWithRelations | undefined
) => {
    return roster.filter(r => 
        r.championId === championId && 
        isChampionValidForEncounterOrQuest(r, quest, encounter)
    ).length;
};
