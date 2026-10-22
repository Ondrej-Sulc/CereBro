import { Champion as PrismaChampion, ChampionClass } from "@prisma/client";
import { RosterWithChampion } from "@cerebro/core/services/rosterService";
import { ChampionImages } from "@/types/champion";
import type { EffectSourceMetadata } from "@cerebro/core/domain/ability-source";
import type { RosterKitFilters } from "@/lib/roster-kit";
import type { KitResistance } from "@/lib/champion-kit";

export type ProfileRosterEntry = Omit<RosterWithChampion, 'champion'> & {
    isUnowned?: boolean;
    champion: Omit<PrismaChampion, 'images'> & {
        images: ChampionImages;
        tags: { id: string | number, name: string }[];
        abilities: (Partial<EffectSourceMetadata> & {
            id: number;
            type: string;
            source: string | null;
            resistances?: KitResistance[];
            ability: {
                name: string;
                iconUrl: string | null;
                gameGlossaryTermId: string | null;
                description: string | null;
                gameGlossaryTerm: { raw: unknown } | null;
                categories: { name: string }[];
            };
            synergyChampions: {
                champion: {
                    name: string;
                    images: ChampionImages;
                };
            }[];
        })[];
    }
};

export interface Recommendation {
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    ascensionLevel: number;
    fromRank: number;
    toRank: number;
    prestigeGain: number;
    accountGain: number;
    reason: PrestigeRecommendationReason;
    globalPrestigeRank: number | null;
    globalPrestigeRankTotal: number | null;
}

export interface SigRecommendation {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    ascensionLevel: number;
    rank: number;
    fromSig: number;
    toSig: number;
    prestigeGain: number;
    accountGain: number;
    prestigePerSig: number;
    reason: PrestigeRecommendationReason;
    globalPrestigeRank: number | null;
    globalPrestigeRankTotal: number | null;
}

export interface PotentialRecommendation {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    ascensionLevel: number;
    fromRank: number;
    toRank: number;
    fromSig: number;
    toSig: number;
    currentPrestige: number;
    targetPrestige: number;
    prestigeGain: number;
    accountGain: number;
    reason: PrestigeRecommendationReason;
    globalPrestigeRank: number | null;
    globalPrestigeRankTotal: number | null;
}

export type PrestigeRecommendationReason = "already_top30" | "enters_top30" | "improves_top30";

export type PrestigeInsightTab = "potential" | "rank" | "sig" | "global";

export type RosterSortField = "NAME" | "RELEASE_DATE" | "PRESTIGE";

export type SortDirection = "ASC" | "DESC";

export interface FilterState extends RosterKitFilters {
    tags: string[];
}

export interface PrestigePoint {
    sig: number;
    prestige: number;
}
