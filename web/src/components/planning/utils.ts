import { RosterWithChampion, QuestWithRelations, EncounterWithRelations } from "./types";
import { Tag } from "@prisma/client";
import { hasObtainableStarInRange } from "@/lib/champion-obtainable";

type RestrictionInput = {
    minStarLevel?: number | null;
    maxStarLevel?: number | null;
    requiredClasses?: RosterWithChampion["champion"]["class"][];
    requiredTags?: Tag[];
};

const matchesRestrictions = (restrictions: RestrictionInput | undefined, r: RosterWithChampion): boolean => {
    if (!restrictions) return true;

    if (r.isUnowned) {
        if (restrictions.minStarLevel || restrictions.maxStarLevel) {
            if (r.stars > 0) {
                if (restrictions.minStarLevel && r.stars < restrictions.minStarLevel) return false;
                if (restrictions.maxStarLevel && r.stars > restrictions.maxStarLevel) return false;
            } else if (!hasObtainableStarInRange(r.champion, restrictions.minStarLevel, restrictions.maxStarLevel)) {
                return false;
            }
        }
    } else {
        if (restrictions.minStarLevel && r.stars < restrictions.minStarLevel) return false;
        if (restrictions.maxStarLevel && r.stars > restrictions.maxStarLevel) return false;
    }
    if (
        restrictions.requiredClasses &&
        restrictions.requiredClasses.length > 0 &&
        !restrictions.requiredClasses.includes(r.champion.class)
    ) {
        return false;
    }
    if (restrictions.requiredTags && restrictions.requiredTags.length > 0) {
        const hasAllTags = restrictions.requiredTags.every((tag) =>
            r.champion.tags?.some(ct => ct.id === tag.id)
        );
        if (!hasAllTags) return false;
    }

    return true;
};

export const isChampionValidForEncounterOrQuest = (
    r: RosterWithChampion,
    quest: QuestWithRelations,
    encounter: EncounterWithRelations | undefined
) => {
    return (
        matchesRestrictions(
            {
                minStarLevel: quest.minStarLevel,
                maxStarLevel: quest.maxStarLevel,
                requiredClasses: quest.requiredClasses,
                requiredTags: quest.requiredTags as Tag[]
            },
            r
        ) &&
        matchesRestrictions(
            encounter
                ? {
                    minStarLevel: encounter.minStarLevel,
                    maxStarLevel: encounter.maxStarLevel,
                    requiredClasses: encounter.requiredClasses,
                    requiredTags: encounter.requiredTags as Tag[]
                }
                : undefined,
            r
        )
    );
};

export const getValidRosterCountForChampion = (
    championId: number,
    roster: RosterWithChampion[],
    quest: QuestWithRelations,
    encounter: EncounterWithRelations | undefined
) => {
    return roster.filter(r => 
        r.championId === championId && 
        !r.isUnowned &&
        isChampionValidForEncounterOrQuest(r, quest, encounter)
    ).length;
};
