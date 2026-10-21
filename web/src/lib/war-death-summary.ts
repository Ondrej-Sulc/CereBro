import { ChampionClass, type Prisma } from "@prisma/client";
import type { ChampionImages } from "../types/champion";
import { getChampionImageUrl, isChampionImages } from "./championHelper";

interface DeathSummaryChampion {
  name: string;
  images?: ChampionImages | Prisma.JsonValue;
  class?: ChampionClass | null;
}

export interface RecordedDeathChampion {
  class: ChampionClass | null;
  imageUrl: string | null;
}

/** Only the presentation metadata crosses the season/planner summary boundary. */
function projectChampion(champion?: DeathSummaryChampion | null): RecordedDeathChampion {
  // The general helper returns a transparent GIF for missing URLs. An absent
  // source here must instead let the portrait's visible fallback render.
  const images = champion?.images;
  const imageUrl = isChampionImages(images) && typeof images.p_64 === "string" && images.p_64.trim()
    ? getChampionImageUrl(images, "64") : null;
  return {
    class: champion?.class && Object.values(ChampionClass).includes(champion.class) ? champion.class : null,
    imageUrl,
  };
}

/** Minimal shared input for season statistics and the live attack planner. */
export interface DeathSummaryFight {
  id: string;
  battlegroup: number;
  death: number;
  node: { nodeNumber: number };
  player: { id: string; ingameName: string } | null;
  attacker?: DeathSummaryChampion | null;
  defender?: DeathSummaryChampion | null;
  videoId?: string | null;
  notes?: string | null;
}

export interface DeathSummaryWar {
  id: string;
  season: number;
  warNumber: number | null;
  enemyAlliance: string | null;
  fights: readonly DeathSummaryFight[];
}

export interface RecordedDeathFight {
  id: string;
  deaths: number;
  attackerName: string;
  defenderName: string;
  attacker: RecordedDeathChampion;
  defender: RecordedDeathChampion;
  videoId: string | null;
  notes: string | null;
}

export interface PlayerDeathSummary {
  playerId: string | null;
  playerName: string;
  deaths: number;
  nodes: { nodeNumber: number; deaths: number; fights: RecordedDeathFight[] }[];
}

export interface BattlegroupDeathSummary {
  battlegroup: number;
  deaths: number;
  players: PlayerDeathSummary[];
}

export interface WarDeathSummary {
  warId: string;
  season: number;
  warNumber: number | null;
  opponent: string;
  deaths: number;
  battlegroups: BattlegroupDeathSummary[];
}

/** Recorded deaths are evidence; zero-death assignments establish no fight outcome. */
export function summarizeWarDeaths(wars: readonly DeathSummaryWar[]): WarDeathSummary[] {
  return wars.map(war => {
    const battlegroups = [1, 2, 3].map(battlegroup => {
      const players = new Map<string | null, PlayerDeathSummary>();
      let deaths = 0;
      for (const fight of war.fights) {
        if (fight.battlegroup !== battlegroup || fight.death <= 0) continue;
        deaths += fight.death;
        // Identity belongs to the historical fight, never to today's alliance roster/BG.
        const playerId = fight.player?.id ?? null;
        let player = players.get(playerId);
        if (!player) {
          player = { playerId, playerName: fight.player?.ingameName ?? "Unassigned / deleted player", deaths: 0, nodes: [] };
          players.set(playerId, player);
        }
        player.deaths += fight.death;
        let node = player.nodes.find(node => node.nodeNumber === fight.node.nodeNumber);
        if (!node) {
          node = { nodeNumber: fight.node.nodeNumber, deaths: 0, fights: [] };
          player.nodes.push(node);
        }
        node.deaths += fight.death;
        node.fights.push({
          id: fight.id, deaths: fight.death,
          attackerName: fight.attacker?.name ?? "Unknown attacker",
          defenderName: fight.defender?.name ?? "Unknown defender",
          attacker: projectChampion(fight.attacker),
          defender: projectChampion(fight.defender),
          videoId: fight.videoId ?? null, notes: fight.notes ?? null,
        });
      }
      const sortedPlayers = [...players.values()].sort((a, b) => b.deaths - a.deaths || a.playerName.localeCompare(b.playerName));
      for (const player of sortedPlayers) player.nodes.sort((a, b) => a.nodeNumber - b.nodeNumber);
      return { battlegroup, deaths, players: sortedPlayers };
    });
    return {
      warId: war.id, season: war.season, warNumber: war.warNumber,
      opponent: war.enemyAlliance ?? "Unknown opponent",
      deaths: battlegroups.reduce((sum, bg) => sum + bg.deaths, 0), battlegroups,
    };
  }).sort((a, b) => (a.warNumber ?? 0) - (b.warNumber ?? 0) || a.warId.localeCompare(b.warId));
}
