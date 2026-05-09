import type { QuestPlan, QuestEncounter, Champion as PrismaChampion, Roster, PlayerQuestEncounter, PlayerQuestRouteChoice, Tag, QuestEncounterNode, NodeModifier, ChampionClass, Prisma, PlayerQuestSynergyChampion } from "@prisma/client";
import { ChampionImages, Champion } from "@/types/champion";
import type { getQuestPlanById } from "@/app/actions/quests";
import type { PopularCountersMap, EnhancedCountersMap } from "@/app/actions/quests";

export type QuestWithRelations = NonNullable<Prisma.PromiseReturnType<typeof getQuestPlanById>>;
export type EncounterWithRelations = QuestWithRelations["encounters"][0];
export type EncounterNodeWithRelations = EncounterWithRelations["nodes"][0];

export type SynergyWithChampion = PlayerQuestSynergyChampion & {
    champion: Champion;
};

export type RosterWithChampion = Roster & {
    champion: Champion;
    isUnowned?: boolean;
};

export interface FilterMetadata {
    tags: { id: string | number, name: string }[];
    abilityCategories: { id: string | number, name: string }[];
    abilities: { id: string | number, name: string }[];
    immunities: { id: string | number, name: string }[];
}

export interface QuestTimelineProps {
    quest: QuestWithRelations;
    roster?: RosterWithChampion[];
    savedEncounters?: PlayerQuestEncounter[];
    savedRouteChoices?: PlayerQuestRouteChoice[];
    savedSynergies?: SynergyWithChampion[];
    popularCounters?: PopularCountersMap;
    featuredPicks?: EnhancedCountersMap;
    alliancePicks?: EnhancedCountersMap;
    filterMetadata?: FilterMetadata;
    readOnly?: boolean;
    rosterMap?: Record<string, unknown>;
    initialSelections?: Record<string, number | null>;
}

export function toChampionImages(images: unknown): ChampionImages {
    if (!images || typeof images !== "object") {
        return {
            hero: "",
            full_primary: "",
            full_secondary: "",
            p_32: "",
            s_32: "",
            p_64: "",
            s_64: "",
            p_128: "",
            s_128: "",
        };
    }
    const imgObj = images as Record<string, unknown>;
    return {
        hero: typeof imgObj.hero === "string" ? imgObj.hero : "",
        full_primary: typeof imgObj.full_primary === "string" ? imgObj.full_primary : "",
        full_secondary: typeof imgObj.full_secondary === "string" ? imgObj.full_secondary : "",
        p_32: typeof imgObj.p_32 === "string" ? imgObj.p_32 : "",
        s_32: typeof imgObj.s_32 === "string" ? imgObj.s_32 : "",
        p_64: typeof imgObj.p_64 === "string" ? imgObj.p_64 : "",
        s_64: typeof imgObj.s_64 === "string" ? imgObj.s_64 : "",
        p_128: typeof imgObj.p_128 === "string" ? imgObj.p_128 : "",
        s_128: typeof imgObj.s_128 === "string" ? imgObj.s_128 : "",
    };
}
