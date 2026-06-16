import { ChampionClass } from "@prisma/client";
import { getFromCache } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { ChampionImages } from "@/types/champion";
import { getNodeCategory, getPathLabel } from "@cerebro/core/data/war-planning/path-logic";

const PLAYER_WAR_INSIGHTS_TTL_SECONDS = 300;
const INSIGHT_LIMIT = 8;

export type PlayerWarInsightScope =
  | { type: "all" }
  | { type: "season"; season: number };

export interface PlayerWarNodeInsight {
  nodeNumber: number;
  label: string;
  category: "path" | "mini-boss" | "boss";
  fights: number;
  deaths: number;
  soloRate: number;
}

export interface PlayerWarNodeGroupInsight {
  key: string;
  label: string;
  category: "path" | "mini-boss" | "boss";
  nodeNumbers: number[];
  fights: number;
  deaths: number;
  soloRate: number;
}

export interface PlayerWarAttackerInsight {
  championId: number;
  name: string;
  class: ChampionClass;
  images: ChampionImages;
  fights: number;
  deaths: number;
  soloRate: number;
}

export interface PlayerWarInsights {
  scope: PlayerWarInsightScope;
  availableSeasons: number[];
  totalWars: number;
  totalFights: number;
  totalDeaths: number;
  soloRate: number;
  battlegroups: number[];
  topNodes: PlayerWarNodeInsight[];
  topNodeGroups: PlayerWarNodeGroupInsight[];
  topAttackers: PlayerWarAttackerInsight[];
}

interface RawPlayerWarInsightFight {
  warId: string;
  battlegroup: number;
  death: number;
  node: {
    nodeNumber: number;
  };
  attacker: {
    id: number;
    name: string;
    class: ChampionClass;
    images: unknown;
  } | null;
}

interface MutableNodeInsight {
  nodeNumber: number;
  fights: number;
  deaths: number;
}

interface MutableNodeGroupInsight {
  key: string;
  label: string;
  category: "path" | "mini-boss" | "boss";
  nodeNumbers: Set<number>;
  fights: number;
  deaths: number;
}

interface MutableAttackerInsight {
  championId: number;
  name: string;
  class: ChampionClass;
  images: ChampionImages;
  fights: number;
  deaths: number;
}

export function normalizePlayerWarInsightScope(
  requestedSeason: string | string[] | undefined,
  availableSeasons: number[],
): PlayerWarInsightScope {
  const value = Array.isArray(requestedSeason) ? requestedSeason[0] : requestedSeason;
  if (!value || value === "all") return { type: "all" };

  const season = Number.parseInt(value, 10);
  if (!Number.isInteger(season) || !availableSeasons.includes(season)) {
    return { type: "all" };
  }

  return { type: "season", season };
}

export async function getAvailablePlayerWarInsightSeasons(input: {
  playerId: string;
  allianceId: string;
}): Promise<number[]> {
  const { playerId, allianceId } = input;

  return getFromCache(`player-war-insight-seasons-${playerId}-${allianceId}`, PLAYER_WAR_INSIGHTS_TTL_SECONDS, async () => {
    const seasons = await prisma.war.findMany({
      where: {
        allianceId,
        status: { not: "PLANNING" },
        warNumber: { not: null },
        season: { not: 0 },
        fights: { some: { playerId } },
      },
      distinct: ["season"],
      select: { season: true },
      orderBy: { season: "desc" },
    });

    return seasons.map((season) => season.season);
  });
}

export async function getPlayerWarInsights(input: {
  playerId: string;
  allianceId: string;
  scope: PlayerWarInsightScope;
}): Promise<PlayerWarInsights> {
  const { playerId, allianceId, scope } = input;
  const scopeKey = scope.type === "all" ? "all" : `season-${scope.season}`;

  return getFromCache(`player-war-insights-${playerId}-${allianceId}-${scopeKey}`, PLAYER_WAR_INSIGHTS_TTL_SECONDS, async () => {
    const [availableSeasons, fights] = await Promise.all([
      getAvailablePlayerWarInsightSeasons({ playerId, allianceId }),
      prisma.warFight.findMany({
        where: {
          playerId,
          war: {
            allianceId,
            status: { not: "PLANNING" },
            warNumber: { not: null },
            season: scope.type === "season" ? scope.season : { not: 0 },
          },
        },
        select: {
          warId: true,
          battlegroup: true,
          death: true,
          node: { select: { nodeNumber: true } },
          attacker: {
            select: {
              id: true,
              name: true,
              class: true,
              images: true,
            },
          },
        },
      }),
    ]);

    return aggregatePlayerWarInsights({ scope, availableSeasons, fights });
  });
}

export function aggregatePlayerWarInsights(input: {
  scope: PlayerWarInsightScope;
  availableSeasons: number[];
  fights: RawPlayerWarInsightFight[];
}): PlayerWarInsights {
  const warIds = new Set<string>();
  const battlegroups = new Set<number>();
  const nodeStats = new Map<number, MutableNodeInsight>();
  const nodeGroupStats = new Map<string, MutableNodeGroupInsight>();
  const attackerStats = new Map<number, MutableAttackerInsight>();

  let totalDeaths = 0;

  for (const fight of input.fights) {
    const deaths = Math.max(0, fight.death ?? 0);
    totalDeaths += deaths;
    warIds.add(fight.warId);
    battlegroups.add(fight.battlegroup);

    const nodeNumber = fight.node.nodeNumber;
    const node = nodeStats.get(nodeNumber) ?? { nodeNumber, fights: 0, deaths: 0 };
    node.fights += 1;
    node.deaths += deaths;
    nodeStats.set(nodeNumber, node);

    const category = getNodeCategory(nodeNumber);
    const groupLabel = getNodeGroupLabel(nodeNumber, category);
    const groupKey = `${category}:${groupLabel}`;
    const group = nodeGroupStats.get(groupKey) ?? {
      key: groupKey,
      label: groupLabel,
      category,
      nodeNumbers: new Set<number>(),
      fights: 0,
      deaths: 0,
    };
    group.nodeNumbers.add(nodeNumber);
    group.fights += 1;
    group.deaths += deaths;
    nodeGroupStats.set(groupKey, group);

    if (fight.attacker) {
      const attacker = attackerStats.get(fight.attacker.id) ?? {
        championId: fight.attacker.id,
        name: fight.attacker.name,
        class: fight.attacker.class,
        images: fight.attacker.images as ChampionImages,
        fights: 0,
        deaths: 0,
      };
      attacker.fights += 1;
      attacker.deaths += deaths;
      attackerStats.set(fight.attacker.id, attacker);
    }
  }

  const totalFights = input.fights.length;

  return {
    scope: input.scope,
    availableSeasons: input.availableSeasons,
    totalWars: warIds.size,
    totalFights,
    totalDeaths,
    soloRate: calculateSoloRate(totalFights, totalDeaths),
    battlegroups: Array.from(battlegroups).sort((a, b) => a - b),
    topNodes: Array.from(nodeStats.values())
      .map((node) => ({
        nodeNumber: node.nodeNumber,
        label: getPathLabel(node.nodeNumber),
        category: getNodeCategory(node.nodeNumber),
        fights: node.fights,
        deaths: node.deaths,
        soloRate: calculateSoloRate(node.fights, node.deaths),
      }))
      .sort((a, b) => b.fights - a.fights || b.soloRate - a.soloRate || a.nodeNumber - b.nodeNumber)
      .slice(0, INSIGHT_LIMIT),
    topNodeGroups: Array.from(nodeGroupStats.values())
      .map((group) => ({
        key: group.key,
        label: group.label,
        category: group.category,
        nodeNumbers: Array.from(group.nodeNumbers).sort((a, b) => a - b),
        fights: group.fights,
        deaths: group.deaths,
        soloRate: calculateSoloRate(group.fights, group.deaths),
      }))
      .sort((a, b) => b.fights - a.fights || b.soloRate - a.soloRate || a.label.localeCompare(b.label))
      .slice(0, INSIGHT_LIMIT),
    topAttackers: Array.from(attackerStats.values())
      .map((attacker) => ({
        ...attacker,
        soloRate: calculateSoloRate(attacker.fights, attacker.deaths),
      }))
      .sort((a, b) => b.fights - a.fights || b.soloRate - a.soloRate || a.name.localeCompare(b.name))
      .slice(0, INSIGHT_LIMIT),
  };
}

function calculateSoloRate(fights: number, deaths: number): number {
  if (fights <= 0) return 0;
  return Math.max(0, ((fights - deaths) / fights) * 100);
}

function getNodeGroupLabel(nodeNumber: number, category: "path" | "mini-boss" | "boss") {
  if (category === "mini-boss") return "Mini-bosses";
  if (category === "boss") return "Boss";
  return getPathLabel(nodeNumber);
}
