import {
    QuestPlan,
    QuestCategory,
    Player,
    Tag,
    QuestPlanStatus,
    Champion,
    QuestEncounter,
    NodeModifier,
    QuestEncounterNode,
    QuestRouteSection,
    QuestRoutePath,
    QuestObjective,
    QuestObjectiveRouteChoice,
    QuestObjectiveEncounterRecommendationSet,
    QuestObjectiveEncounterRecommendedChampion,
    PlayerQuestPlan,
} from "@prisma/client";

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
    objectiveRecommendationSets: (QuestObjectiveEncounterRecommendationSet & {
        champions: (QuestObjectiveEncounterRecommendedChampion & {
            champion: Champion;
        })[];
    })[];
    nodes: (QuestEncounterNode & {
        nodeModifier: NodeModifier;
    })[];
};

export type QuestObjectiveWithRelations = QuestObjective & {
    requiredTags: Tag[];
    routeChoices: QuestObjectiveRouteChoice[];
    endpointEncounter: {
        id: string;
        sequence: number;
        defender: { name: string } | null;
    } | null;
};

export type QuestWithRelations = QuestPlan & {
    category: (QuestCategory & { children?: QuestCategory[] }) | null;
    creator?: Player | null;
    creators: CreatorInfo[];
    requiredTags: Tag[];
    objectives: QuestObjectiveWithRelations[];
    encounters: EncounterWithRelations[];
    routeSections: (QuestRouteSection & {
        parentPath: (QuestRoutePath & {
            section: { id: string; title: string };
        }) | null;
        paths: (QuestRoutePath & {
            encounters: { id: string }[];
        })[];
    })[];
    playerPlans?: (PlayerQuestPlan & { player: Player })[];
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
