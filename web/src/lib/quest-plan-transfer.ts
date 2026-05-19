import { ChampionClass, EncounterDifficulty } from "@prisma/client";
export type QuestExportCategory = {
    name: string;
    path: string[];
};

export type QuestExportChampionRef = {
    slug: string | null;
    name: string;
};

export type QuestExportTagRef = {
    name: string;
    category: string;
};

export type QuestExportNodeRef = {
    name: string;
    description: string;
    isHighlighted?: boolean;
};

export type QuestExportCreatorRef = {
    discordId: string;
};

export type QuestExportPlayerRef = {
    discordId: string | null;
    ingameName: string | null;
    botUserDiscordId: string | null;
};

export type QuestPlanExportPayload = {
    schemaVersion: 1;
    kind: "cerebro.questPlan";
    exportedAt: string;
    quest: {
        title: string;
        videoUrl: string | null;
        bannerUrl: string | null;
        bannerFit: string | null;
        bannerPosition: string | null;
        category: QuestExportCategory | null;
        minStarLevel: number | null;
        maxStarLevel: number | null;
        teamLimit: number | null;
        requiredClasses: ChampionClass[];
        requiredTags: QuestExportTagRef[];
        creators: QuestExportCreatorRef[];
    };
    routeSections: {
        key: string;
        title: string;
        order: number;
        parentPathKey: string | null;
        paths: {
            key: string;
            title: string;
            order: number;
        }[];
    }[];
    encounters: {
        sequence: number;
        difficulty: EncounterDifficulty;
        tips: string | null;
        videoUrl: string | null;
        defender: QuestExportChampionRef | null;
        recommendedTags: string[];
        recommendedChampions: QuestExportChampionRef[];
        requiredTags: QuestExportTagRef[];
        nodes: QuestExportNodeRef[];
        routePathKey: string | null;
        videos: {
            videoUrl: string;
            player: QuestExportPlayerRef | null;
        }[];
    }[];
};

export type MissingQuestImportReferences = {
    champions: string[];
    tags: string[];
    nodeModifiers: string[];
    categories: string[];
    creators: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function asOptionalString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function tagKey(tag: Pick<QuestExportTagRef, "name" | "category">): string {
    return `${tag.name}::${tag.category}`;
}

export function formatTagRef(tag: Pick<QuestExportTagRef, "name" | "category">): string {
    return tag.category ? `${tag.name} (${tag.category})` : tag.name;
}

export function formatChampionRef(champion: QuestExportChampionRef): string {
    return champion.slug ? `${champion.name} [${champion.slug}]` : champion.name;
}

export function formatCategoryRef(category: QuestExportCategory): string {
    return category.path.length > 0 ? category.path.join(" / ") : category.name;
}

export function makeRouteSectionKey(order: number, title: string): string {
    return `section:${order}:${title}`;
}

export function makeRoutePathKey(sectionKey: string, order: number, title: string): string {
    return `${sectionKey}/path:${order}:${title}`;
}

export function summarizeMissingQuestImportReferences(missing: MissingQuestImportReferences): string {
    const parts: string[] = [];
    if (missing.champions.length) parts.push(`Champions: ${missing.champions.join(", ")}`);
    if (missing.tags.length) parts.push(`Tags: ${missing.tags.join(", ")}`);
    if (missing.nodeModifiers.length) parts.push(`Node modifiers: ${missing.nodeModifiers.join(", ")}`);
    if (missing.categories.length) parts.push(`Categories: ${missing.categories.join(", ")}`);
    if (missing.creators.length) parts.push(`Creators: ${missing.creators.join(", ")}`);
    return parts.join("\n");
}

export function parseQuestPlanExport(jsonText: string): QuestPlanExportPayload {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new Error("Invalid JSON format.");
    }

    if (!isPlainObject(parsed) || parsed.kind !== "cerebro.questPlan" || parsed.schemaVersion !== 1) {
        throw new Error("Unsupported quest plan export. Expected kind \"cerebro.questPlan\" with schemaVersion 1.");
    }
    if (!isPlainObject(parsed.quest)) {
        throw new Error("Invalid quest plan export: missing quest object.");
    }

    const quest = parsed.quest;
    const title = asString(quest.title)?.trim();
    if (!title) {
        throw new Error("Invalid quest plan export: quest.title is required.");
    }

    const rawCategory = isPlainObject(quest.category) ? quest.category : null;
    const category = rawCategory
        ? {
            name: asString(rawCategory.name)?.trim() || "",
            path: asStringArray(rawCategory.path).map(item => item.trim()).filter(Boolean)
        }
        : null;
    if (category && !category.name && category.path.length === 0) {
        throw new Error("Invalid quest plan export: quest.category requires a name or path.");
    }

    const routeSections = Array.isArray(parsed.routeSections) ? parsed.routeSections : [];
    const encounters = Array.isArray(parsed.encounters) ? parsed.encounters : [];

    return {
        schemaVersion: 1,
        kind: "cerebro.questPlan",
        exportedAt: asString(parsed.exportedAt) || new Date().toISOString(),
        quest: {
            title,
            videoUrl: asOptionalString(quest.videoUrl),
            bannerUrl: asOptionalString(quest.bannerUrl),
            bannerFit: asOptionalString(quest.bannerFit) || "cover",
            bannerPosition: asOptionalString(quest.bannerPosition) || "center",
            category,
            minStarLevel: asNumberOrNull(quest.minStarLevel),
            maxStarLevel: asNumberOrNull(quest.maxStarLevel),
            teamLimit: asNumberOrNull(quest.teamLimit),
            requiredClasses: asStringArray(quest.requiredClasses).filter((item): item is ChampionClass =>
                Object.values(ChampionClass).includes(item as ChampionClass)
            ),
            requiredTags: (Array.isArray(quest.requiredTags) ? quest.requiredTags : [])
                .filter(isPlainObject)
                .map(tag => ({
                    name: asString(tag.name)?.trim() || "",
                    category: asString(tag.category)?.trim() || ""
                }))
                .filter(tag => tag.name),
            creators: (Array.isArray(quest.creators) ? quest.creators : [])
                .filter(isPlainObject)
                .map(creator => ({ discordId: asString(creator.discordId)?.trim() || "" }))
                .filter(creator => creator.discordId)
        },
        routeSections: routeSections
            .filter(isPlainObject)
            .map(section => ({
                key: asString(section.key)?.trim() || "",
                title: asString(section.title)?.trim() || "Section",
                order: asNumberOrNull(section.order) ?? 0,
                parentPathKey: asOptionalString(section.parentPathKey),
                paths: (Array.isArray(section.paths) ? section.paths : [])
                    .filter(isPlainObject)
                    .map(path => ({
                        key: asString(path.key)?.trim() || "",
                        title: asString(path.title)?.trim() || "Path",
                        order: asNumberOrNull(path.order) ?? 0
                    }))
                    .filter(path => path.key)
            }))
            .filter(section => section.key),
        encounters: encounters
            .filter(isPlainObject)
            .map(encounter => {
                const rawDefender = isPlainObject(encounter.defender) ? encounter.defender : null;
                return {
                    sequence: asNumberOrNull(encounter.sequence) ?? 0,
                    difficulty: Object.values(EncounterDifficulty).includes(encounter.difficulty as EncounterDifficulty)
                        ? encounter.difficulty as EncounterDifficulty
                        : EncounterDifficulty.NORMAL,
                    tips: asOptionalString(encounter.tips),
                    videoUrl: asOptionalString(encounter.videoUrl),
                    defender: rawDefender ? {
                        slug: asOptionalString(rawDefender.slug),
                        name: asString(rawDefender.name)?.trim() || ""
                    } : null,
                    recommendedTags: asStringArray(encounter.recommendedTags),
                    recommendedChampions: (Array.isArray(encounter.recommendedChampions) ? encounter.recommendedChampions : [])
                        .filter(isPlainObject)
                        .map(champion => ({
                            slug: asOptionalString(champion.slug),
                            name: asString(champion.name)?.trim() || ""
                        }))
                        .filter(champion => champion.name),
                    requiredTags: (Array.isArray(encounter.requiredTags) ? encounter.requiredTags : [])
                        .filter(isPlainObject)
                        .map(tag => ({
                            name: asString(tag.name)?.trim() || "",
                            category: asString(tag.category)?.trim() || ""
                        }))
                        .filter(tag => tag.name),
                    nodes: (Array.isArray(encounter.nodes) ? encounter.nodes : [])
                        .filter(isPlainObject)
                        .map(node => ({
                            name: asString(node.name)?.trim() || "",
                            description: asString(node.description)?.trim() || "",
                            isHighlighted: node.isHighlighted === true
                        }))
                        .filter(node => node.name),
                    routePathKey: asOptionalString(encounter.routePathKey),
                    videos: (Array.isArray(encounter.videos) ? encounter.videos : [])
                        .filter(isPlainObject)
                        .map(video => {
                            const rawPlayer = isPlainObject(video.player) ? video.player : null;
                            return {
                                videoUrl: asString(video.videoUrl)?.trim() || "",
                                player: rawPlayer ? {
                                    discordId: asOptionalString(rawPlayer.discordId),
                                    ingameName: asOptionalString(rawPlayer.ingameName),
                                    botUserDiscordId: asOptionalString(rawPlayer.botUserDiscordId)
                                } : null
                            };
                        })
                        .filter(video => video.videoUrl)
                };
            })
    };
}

