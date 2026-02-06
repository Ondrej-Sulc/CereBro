import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";

export interface ChampionStat {
    id: number;
    name: string;
    class: ChampionClass;
    images: ChampionImages;
    count: number; // Usage count
    deaths: number; // Deaths caused (for defenders) or suffered (for attackers)
    fights: number; // Total fights involved in
}

export interface NodeStat {
    nodeNumber: number;
    deaths: number;
    fights: number;
}

export interface WarFightDetail {
  defenderName: string;
  defenderClass: ChampionClass;
  defenderImageUrl: string;
  attackerName: string;
  attackerClass: ChampionClass;
  attackerImageUrl: string;
  nodeNumber: number;
  isSolo: boolean;
  deaths: number;
  videoId: string | null;
  isAttackerTactic: boolean;
  isDefenderTactic: boolean;
}

export interface PlayerWarStat {
  warId: string;
  warNumber: number;
  opponent: string;
  fights: number;
  deaths: number;
  fightDetails: WarFightDetail[];
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  avatar: string | null;
  fights: number;
  deaths: number;
  pathFights: number;
  pathDeaths: number;
  miniBossFights: number;
  miniBossDeaths: number;
  bossFights: number;
  bossDeaths: number;
  battlegroup: number;
  warStats: PlayerWarStat[];
}
