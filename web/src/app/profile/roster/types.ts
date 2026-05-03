import { Champion as PrismaChampion, ChampionClass } from "@prisma/client";
import { RosterWithChampion } from "@cerebro/core/services/rosterService";
import { ChampionImages } from "@/types/champion";

export type ProfileRosterEntry = Omit<RosterWithChampion, 'champion'> & {
    isUnowned?: boolean;
    champion: Omit<PrismaChampion, 'images'> & {
        images: ChampionImages;
        tags: { id: string | number, name: string }[];
        abilities: {
            type: string;
            source: string | null;
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
        }[];
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
}

export interface FilterState {
    tags: string[];
    categories: string[];
    abilities: string[];
    immunities: string[];
}

export interface PrestigePoint {
    sig: number;
    prestige: number;
}
