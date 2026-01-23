import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";

export interface DetailedPlacementStat {
  nodeNumber: number;
  defenderId: number;
  defenderName: string;
  defenderClass: ChampionClass;
  defenderImages: ChampionImages;
  attackerId?: number;
  attackerName?: string;
  attackerClass?: ChampionClass;
  attackerImages?: ChampionImages;
  fights: number;
  deaths: number;
}

export type DeepDiveTab = "defense" | "matchups";
export type DeepDiveSubTab = "node" | "defender" | "attacker" | "counter";

export interface DeepDiveSelection {
  tab: DeepDiveTab;
  subTab: DeepDiveSubTab;
  id: number;
}

export interface ChampionEntity {
  id: number;
  name: string;
  class: ChampionClass;
  images: ChampionImages;
}
