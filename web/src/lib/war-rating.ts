import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import { getNodeTypeMultiplier } from "@cerebro/core/data/war-planning/path-logic";

const BAYESIAN_PRIOR_WEIGHT = 10;
const MIN_DIFFICULTY = 0.6;
const MAX_DIFFICULTY = 2.0;
const BASE_PENALTY = 2.5;
const SOLO_WEIGHT = 6.0;
const SOLO_PENALTY_DAMPING = 0.25;
const MIN_ALLIANCE_WARS = 5;

export interface DifficultyRatings {
  nodes: Map<number, number>;
  defenders: Map<number, number>;
}

interface RawStat {
  fights: number;
  deaths: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bayesianSmooth(observed: number, sampleSize: number): number {
  return (sampleSize * observed + BAYESIAN_PRIOR_WEIGHT * 1.0) / (sampleSize + BAYESIAN_PRIOR_WEIGHT);
}

/**
 * Fetches global difficulty ratings for nodes and defenders at a given war tier.
 * Uses data from all qualifying alliances (5+ finished wars).
 * Cached for 1 hour.
 */
export async function getGlobalDifficulties(warTier: number): Promise<DifficultyRatings> {
  return getFromCache(`global-difficulties-tier-${warTier}`, 3600, async () => {
    // Find alliances with enough completed wars to be trustworthy
    const qualifiedAlliances = await prisma.war.groupBy({
      by: ['allianceId'],
      where: {
        status: 'FINISHED',
        warNumber: { not: null },
      },
      _count: { id: true },
      having: {
        id: { _count: { gte: MIN_ALLIANCE_WARS } },
      },
    });

    const qualifiedAllianceIds = qualifiedAlliances.map(a => a.allianceId);

    if (qualifiedAllianceIds.length === 0) {
      return { nodes: new Map(), defenders: new Map() };
    }

    // Fetch all fights from qualifying wars at this tier
    const fights = await prisma.warFight.findMany({
      where: {
        war: {
          status: 'FINISHED',
          warNumber: { not: null },
          warTier: warTier,
          allianceId: { in: qualifiedAllianceIds },
        },
        player: { isNot: null },
      },
      select: {
        death: true,
        nodeId: true,
        defenderId: true,
        node: { select: { nodeNumber: true } },
      },
    });

    // Aggregate node stats
    const nodeRawStats = new Map<number, RawStat>();
    const defenderRawStats = new Map<number, RawStat>();

    for (const fight of fights) {
      const deathValue = fight.death ?? 0;

      if (fight.node) {
        const nodeNum = fight.node.nodeNumber;
        const stat = nodeRawStats.get(nodeNum) ?? { fights: 0, deaths: 0 };
        stat.fights++;
        stat.deaths += deathValue;
        nodeRawStats.set(nodeNum, stat);
      }

      if (fight.defenderId) {
        const stat = defenderRawStats.get(fight.defenderId) ?? { fights: 0, deaths: 0 };
        stat.fights++;
        stat.deaths += deathValue;
        defenderRawStats.set(fight.defenderId, stat);
      }
    }

    // Compute average death rate across all nodes
    let totalNodeFights = 0;
    let totalNodeDeaths = 0;
    for (const stat of nodeRawStats.values()) {
      totalNodeFights += stat.fights;
      totalNodeDeaths += stat.deaths;
    }
    const avgNodeDeathRate = totalNodeFights > 0 ? totalNodeDeaths / totalNodeFights : 0;

    // Compute average death rate across all defenders
    let totalDefFights = 0;
    let totalDefDeaths = 0;
    for (const stat of defenderRawStats.values()) {
      totalDefFights += stat.fights;
      totalDefDeaths += stat.deaths;
    }
    const avgDefDeathRate = totalDefFights > 0 ? totalDefDeaths / totalDefFights : 0;

    // Calculate node difficulties
    const nodes = new Map<number, number>();
    for (const [nodeNum, stat] of nodeRawStats) {
      if (avgNodeDeathRate === 0) {
        nodes.set(nodeNum, 1.0);
        continue;
      }
      const deathRate = stat.fights > 0 ? stat.deaths / stat.fights : 0;
      const raw = deathRate / avgNodeDeathRate;
      const smoothed = bayesianSmooth(raw, stat.fights);
      nodes.set(nodeNum, clamp(smoothed, MIN_DIFFICULTY, MAX_DIFFICULTY));
    }

    // Calculate defender difficulties
    const defenders = new Map<number, number>();
    for (const [defId, stat] of defenderRawStats) {
      if (avgDefDeathRate === 0) {
        defenders.set(defId, 1.0);
        continue;
      }
      const deathRate = stat.fights > 0 ? stat.deaths / stat.fights : 0;
      const raw = deathRate / avgDefDeathRate;
      const smoothed = bayesianSmooth(raw, stat.fights);
      defenders.set(defId, clamp(smoothed, MIN_DIFFICULTY, MAX_DIFFICULTY));
    }

    return { nodes, defenders };
  });
}

/**
 * Calculates the score for a single fight.
 */
export function calculateFightScore(
  deaths: number,
  nodeDifficulty: number,
  defenderDifficulty: number,
  nodeTypeMultiplier: number
): number {
  const combinedDifficulty = ((nodeDifficulty + defenderDifficulty) / 2) * nodeTypeMultiplier;
  const safeDifficulty = Math.max(combinedDifficulty, MIN_DIFFICULTY);

  if (deaths === 0) {
    return safeDifficulty;
  }

  return safeDifficulty - deaths * (BASE_PENALTY / Math.sqrt(safeDifficulty));
}

/**
 * Calculates the solo bonus for a player relative to the alliance average.
 * Asymmetric: full reward for above-average, dampened penalty for below.
 */
export function calculateSoloBonus(
  playerSoloRate: number,
  avgSoloRate: number,
  totalFights: number
): number {
  const diff = playerSoloRate - avgSoloRate;

  if (diff >= 0) {
    return diff * SOLO_WEIGHT * totalFights;
  }

  return diff * SOLO_WEIGHT * totalFights * SOLO_PENALTY_DAMPING;
}

/**
 * Assigns letter grades based on normalized 0-100 rating.
 */
export function getGrade(normalizedRating: number): string {
  if (normalizedRating >= 90) return 'S';
  if (normalizedRating >= 75) return 'A';
  if (normalizedRating >= 60) return 'B';
  if (normalizedRating >= 40) return 'C';
  return 'D';
}

const QUALITY_WEIGHT = 0.5;
const VOLUME_WEIGHT = 0.5;

function minMaxNormalize(values: Map<string, number>): Map<string, number> {
  const nums = Array.from(values.values());
  if (nums.length <= 1) {
    const result = new Map<string, number>();
    for (const key of values.keys()) result.set(key, 50);
    return result;
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  const result = new Map<string, number>();

  for (const [key, val] of values) {
    result.set(key, range > 0 ? ((val - min) / range) * 100 : 50);
  }
  return result;
}

/**
 * Normalizes ratings using a blend of per-fight quality (50%) and total volume (50%).
 * Both dimensions are independently normalized to 0-100, then blended.
 */
export function normalizeRatings(
  perFightRatings: Map<string, number>,
  totalRatings: Map<string, number>
): Map<string, { normalizedRating: number; grade: string }> {
  const result = new Map<string, { normalizedRating: number; grade: string }>();
  if (perFightRatings.size === 0) return result;

  const normalizedQuality = minMaxNormalize(perFightRatings);
  const normalizedVolume = minMaxNormalize(totalRatings);

  for (const playerId of perFightRatings.keys()) {
    const quality = normalizedQuality.get(playerId) ?? 50;
    const volume = normalizedVolume.get(playerId) ?? 50;
    const blended = quality * QUALITY_WEIGHT + volume * VOLUME_WEIGHT;
    result.set(playerId, { normalizedRating: blended, grade: getGrade(blended) });
  }

  return result;
}
