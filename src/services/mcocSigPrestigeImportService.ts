import { PrismaClient } from '@prisma/client';
import {
  ChampionRecord,
  matchGameChampionIdentity,
} from './mcocGameStatsImportService';

export type SigPrestigeFile = {
  metadata?: {
    schemaVersion?: number;
    generatedAt?: string;
    summary?: {
      champions?: number;
      rows?: number;
      missingRuntimeRows?: number;
    };
  };
  champions: SigPrestigeChampion[];
};

export type SigPrestigeChampion = {
  gameId: string;
  tiers: SigPrestigeTier[];
};

export type SigPrestigeTier = {
  tierId: string;
  rarity?: number | null;
  rarityLabel?: string | null;
  sigLevels: SigPrestigeLevel[];
};

export type SigPrestigeLevel = {
  sigLevel: number;
  ranks: SigPrestigeRank[];
};

export type SigPrestigeRank = {
  rank: number;
  sigLevel: number;
  prestige: number | null;
};

export type McocSigPrestigeImportReport = {
  schemaVersion: number | string;
  generatedAt: string;
  championCount: number;
  tierCount: number;
  inputSigRows: number;
  matched: number;
  unmatched: string[];
  ambiguous: string[];
  conflicts: string[];
  baselineRows: number;
  maxSigRows: number;
  skippedRows: number;
  canWrite: boolean;
  written?: {
    upsertedBaselineRows: number;
    upsertedMaxSigRows: number;
  };
};

export function parseMcocSigPrestigeJson(text: string): SigPrestigeFile {
  const data = JSON.parse(text) as SigPrestigeFile;
  if (!Array.isArray(data.champions)) {
    throw new Error('Invalid sig prestige file: expected champions array');
  }
  return data;
}

function countRows(data: SigPrestigeFile) {
  let tierCount = 0;
  let inputSigRows = 0;
  for (const champion of data.champions) {
    tierCount += champion.tiers.length;
    for (const tier of champion.tiers) {
      for (const sigLevel of tier.sigLevels) {
        inputSigRows += sigLevel.ranks.length;
      }
    }
  }
  return {
    championCount: data.champions.length,
    tierCount,
    inputSigRows,
  };
}

function summarizeMatches(
  data: SigPrestigeFile,
  champions: ChampionRecord[]
) {
  const matched = new Map<string, ChampionRecord>();
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const conflicts: string[] = [];

  for (const champion of data.champions) {
    const result = matchGameChampionIdentity(
      {
        gameId: champion.gameId,
        gameFullName: champion.gameId,
        gameShortName: champion.gameId,
      },
      champions
    );

    if (result.status === 'matched') {
      matched.set(champion.gameId, result.champion);
    } else if (result.status === 'ambiguous') {
      ambiguous.push(`${champion.gameId}: ${result.reason}`);
    } else if (result.status === 'conflict') {
      conflicts.push(`${champion.gameId}: ${result.reason}`);
    } else {
      unmatched.push(`${champion.gameId}: ${result.reason}`);
    }
  }

  return { matched, unmatched, ambiguous, conflicts };
}

async function buildBaselinePrestigeLookup(
  prisma: PrismaClient,
  championIds: number[]
) {
  const rows = await prisma.championStats.findMany({
    where: {
      championId: { in: championIds },
      prestige: { not: null },
      rarity: { not: null },
    },
    select: {
      championId: true,
      tierId: true,
      rarity: true,
      rank: true,
      prestige: true,
    },
  });

  const lookup = new Map<string, number>();
  for (const row of rows) {
    if (row.rarity == null || row.prestige == null) continue;
    lookup.set(`${row.championId}:${row.tierId}:${row.rank}`, row.prestige);
  }
  return lookup;
}

async function writeImport(
  prisma: PrismaClient,
  data: SigPrestigeFile,
  matched: Map<string, ChampionRecord>,
  baselineLookup: Map<string, number>
) {
  let upsertedBaselineRows = 0;
  let upsertedMaxSigRows = 0;

  const operations: ReturnType<typeof prisma.championPrestige.upsert>[] = [];

  for (const gameChampion of data.champions) {
    const champion = matched.get(gameChampion.gameId);
    if (!champion) continue;

    for (const tier of gameChampion.tiers) {
      if (tier.rarity == null) continue;
      const ranksSeen = new Set<number>();

      for (const sigLevel of tier.sigLevels) {
        for (const rank of sigLevel.ranks) {
          if (rank.prestige == null) continue;
          ranksSeen.add(rank.rank);

          operations.push(
            prisma.championPrestige.upsert({
              where: {
                championId_rarity_rank_sig: {
                  championId: champion.id,
                  rarity: tier.rarity,
                  rank: rank.rank,
                  sig: rank.sigLevel,
                },
              },
              update: { prestige: rank.prestige },
              create: {
                championId: champion.id,
                rarity: tier.rarity,
                rank: rank.rank,
                sig: rank.sigLevel,
                prestige: rank.prestige,
              },
            })
          );
          upsertedMaxSigRows++;
        }
      }

      for (const rank of ranksSeen) {
        const baselinePrestige = baselineLookup.get(`${champion.id}:${tier.tierId}:${rank}`);
        if (baselinePrestige == null) continue;

        operations.push(
          prisma.championPrestige.upsert({
            where: {
              championId_rarity_rank_sig: {
                championId: champion.id,
                rarity: tier.rarity,
                rank,
                sig: 0,
              },
            },
            update: { prestige: baselinePrestige },
            create: {
              championId: champion.id,
              rarity: tier.rarity,
              rank,
              sig: 0,
              prestige: baselinePrestige,
            },
          })
        );
        upsertedBaselineRows++;
      }
    }
  }

  await prisma.$transaction(operations);

  return { upsertedBaselineRows, upsertedMaxSigRows };
}

export async function importMcocSigPrestige(
  prisma: PrismaClient,
  data: SigPrestigeFile,
  options: { write?: boolean } = {}
): Promise<McocSigPrestigeImportReport> {
  const champions = await prisma.champion.findMany({
    select: { id: true, name: true, shortName: true, gameId: true },
  });
  const { matched, unmatched, ambiguous, conflicts } = summarizeMatches(data, champions);
  const baselineLookup = await buildBaselinePrestigeLookup(
    prisma,
    [...matched.values()].map(champion => champion.id)
  );

  const counts = countRows(data);
  let baselineRows = 0;
  let maxSigRows = 0;
  let skippedRows = 0;

  for (const gameChampion of data.champions) {
    const champion = matched.get(gameChampion.gameId);
    if (!champion) continue;

    for (const tier of gameChampion.tiers) {
      const ranksSeen = new Set<number>();
      for (const sigLevel of tier.sigLevels) {
        for (const rank of sigLevel.ranks) {
          if (rank.prestige == null || tier.rarity == null) {
            skippedRows++;
            continue;
          }
          maxSigRows++;
          ranksSeen.add(rank.rank);
        }
      }
      for (const rank of ranksSeen) {
        if (baselineLookup.has(`${champion.id}:${tier.tierId}:${rank}`)) {
          baselineRows++;
        }
      }
    }
  }

  const report: McocSigPrestigeImportReport = {
    ...counts,
    schemaVersion: data.metadata?.schemaVersion ?? 'unknown',
    generatedAt: data.metadata?.generatedAt ?? 'unknown',
    matched: matched.size,
    unmatched,
    ambiguous,
    conflicts,
    baselineRows,
    maxSigRows,
    skippedRows,
    canWrite: ambiguous.length === 0 && conflicts.length === 0,
  };

  if (!options.write) return report;
  if (!report.canWrite) {
    throw new Error('Refusing to write while ambiguous or conflicting champions remain.');
  }

  report.written = await writeImport(prisma, data, matched, baselineLookup);
  return report;
}
