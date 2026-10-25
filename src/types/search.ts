import {
  Champion,
  Tag,
  ChampionAbilityLink,
  Ability,
  AbilityCategory,
  Attack,
  Hit,
  Roster,
} from "@prisma/client";
import type { EffectForm, EffectDirection } from "../domain/ability-source";
import type { ChampionEffect, ChampionEffectSource } from "../domain/champion-effects";
import type { ChampionSynergy } from "../domain/champion-synergies";

export interface SearchCoreParams {
  abilities?: string | null;
  immunities?: string | null;
  tags?: string | null;
  championClass?: string | null;
  abilityCategory?: string | null;
  attackType?: string | null;
  effectForm?: EffectForm | null;
  effectDirection?: EffectDirection | null;
  includeResistances?: boolean | null;
  minResistance?: number | null;
  userId: string;
  page?: number;
  searchId?: string;
}

export type ChampionWithRelations = Champion & {
  tags: Tag[];
  effects?: ChampionEffect[];
  gameSynergies?: ChampionSynergy[];
  abilities: (ChampionAbilityLink & Pick<ChampionEffectSource, "synergyChampions" | "overviewSummary" | "resistances"> & {
    ability: Ability & {
      categories: AbilityCategory[];
    };
  })[];
  attacks: (Attack & {
    hits: Hit[];
  })[];
};

export type RosterEntryWithChampionRelations = Roster & {
  champion: ChampionWithRelations;
};
