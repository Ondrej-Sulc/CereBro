import type { Prisma } from "@prisma/client";
import type { getQuestPlanById } from "@/app/actions/quest-catalog";

type BaseQuestWithRelations = NonNullable<Prisma.PromiseReturnType<typeof getQuestPlanById>>;

export type QuestWithRelations = Omit<BaseQuestWithRelations, "creators"> & {
    creators: (BaseQuestWithRelations["creators"][0] & { name?: string })[];
    playerPlans: { player?: { id: string; ingameName: string | null; avatar: string | null } | null }[];
};

export type EncounterWithRelations = BaseQuestWithRelations["encounters"][0];

export type SelectedCreator = {
    id: string;
    name: string;
    avatar: string | null;
    discordId?: string | null;
};

export type EncounterVideoFormValue = {
    videoUrl: string;
    playerId: string | null;
    playerName: string | null;
    playerAvatar: string | null;
};

export type EncounterWithVideos = EncounterWithRelations & {
    videos?: {
        videoUrl: string;
        playerId: string | null;
        player?: { ingameName: string | null; avatar: string | null } | null;
    }[];
};

export type ObjectiveRouteChoiceForm = Record<string, { pathId: string; isLocked: boolean }>;

export type RoutePathOption = {
    id: string;
    label: string;
    sectionTitle: string;
    pathTitle: string;
};
