import { Champion, ChampionClass, Roster } from "@prisma/client";
import { RosterWithChampion } from "@cerebro/core/services/rosterService";

export type ProfileRosterEntry = Omit<RosterWithChampion, 'champion'> & {
    champion: Champion & {
        tags: { id: string | number, name: string }[];
        abilities: {
            type: string;
            source: string | null;
            ability: {
                name: string;
                categories: { name: string }[];
            };
            synergyChampions: {
                champion: {
                    name: string;
                    images: any;
                };
            }[];
        }[];
    }
};

export interface Recommendation {
    championName: string;
    championClass: ChampionClass;
    championImage: any;
    stars: number;
    fromRank: number;
    toRank: number;
    prestigeGain: number;
    accountGain: number;
}

export interface SigRecommendation {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: any;
    stars: number;
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
