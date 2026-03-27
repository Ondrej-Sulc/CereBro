import { QuestPlan, QuestCategory, Player, Tag, QuestPlanStatus, Champion, QuestEncounter, NodeModifier, QuestEncounterNode } from "@prisma/client";

export type CreatorInfo = {
    id: string;
    name: string;
    image: string | null;
    allianceTag?: string | null;
    discordId?: string;
};

export type EncounterWithRelations = QuestEncounter & {
    defender: Champion | null;
    requiredTags: Tag[];
    recommendedChampions: Champion[];
    nodes: (QuestEncounterNode & {
        nodeModifier: NodeModifier;
    })[];
};

export type QuestWithRelations = QuestPlan & {
    category: (QuestCategory & { children?: QuestCategory[] }) | null;
    creator?: Player | null;
    creators: CreatorInfo[];
    requiredTags: Tag[];
    encounters: EncounterWithRelations[];
    personalProgress?: number;
    _count?: {
        playerPlans: number;
    };
};

export type FeaturedPlayerInfo = {
    id: string;
    ingameName: string;
    avatar: string | null;
};

export type QuestSummary = QuestPlan & {
    category: (QuestCategory & { children?: QuestCategory[] }) | null;
    creator?: Player | null;
    creators: CreatorInfo[];
    requiredTags: Tag[];
    encounters: { id: string }[];
    featuredPlayers: FeaturedPlayerInfo[];
    personalProgress?: number;
    _count?: {
        playerPlans: number;
    };
};
