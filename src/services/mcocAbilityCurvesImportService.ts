import { Prisma, PrismaClient } from '@prisma/client';
import {
  ChampionRecord,
  MatchResult,
  matchGameChampionIdentity,
} from './mcocGameStatsImportService';

export type GameAbilityCurveRecord = {
  curveId: string;
  sourceCurveId: string;
  kind: string;
  formula: string;
  minSig?: number | null;
  maxSig?: number | null;
  params: unknown;
};

export type GameAbilityCurveChampion = {
  gameId: string;
  fullName: string;
  shortName?: string;
  curves: GameAbilityCurveRecord[];
};

export type GameAbilityCurvesFile = {
  generatedAt?: string;
  source?: unknown;
  summary?: {
    championsInFile?: number;
    championsWithCurves?: number;
    curveRefs?: number;
    missingComponents?: number;
    missingCurves?: number;
  };
  champions: GameAbilityCurveChampion[];
};

export type McocAbilityCurvesImportReport = {
  generatedAt: string;
  championCount: number;
  curveCount: number;
  matched: number;
  unmatched: string[];
  ambiguous: string[];
  conflicts: string[];
  canWrite: boolean;
  written?: {
    deletedCurves: number;
    upsertedCurves: number;
  };
};

export function parseMcocAbilityCurvesJson(text: string): GameAbilityCurvesFile {
  const data = JSON.parse(text) as GameAbilityCurvesFile;
  if (!data || typeof data !== 'object' || !Array.isArray(data.champions)) {
    throw new Error('Invalid ability curves file: expected object with champions array');
  }
  return data;
}

function countCurves(data: GameAbilityCurvesFile) {
  return data.champions.reduce((count, champion) => count + (champion.curves?.length ?? 0), 0);
}

function formatMatchIssue(champion: GameAbilityCurveChampion, reason: string) {
  return `${champion.gameId}: ${champion.fullName || champion.shortName || champion.gameId} (${reason})`;
}

function summarize(
  data: GameAbilityCurvesFile,
  matches: Map<string, MatchResult>
): McocAbilityCurvesImportReport {
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const conflicts: string[] = [];
  let matched = 0;

  for (const champion of data.champions) {
    const match = matches.get(champion.gameId);
    if (!match) continue;

    if (match.status === 'matched') {
      matched++;
    } else if (match.status === 'unmatched') {
      unmatched.push(formatMatchIssue(champion, match.reason));
    } else if (match.status === 'ambiguous') {
      ambiguous.push(formatMatchIssue(champion, match.reason));
    } else {
      conflicts.push(formatMatchIssue(champion, match.reason));
    }
  }

  return {
    generatedAt: data.generatedAt ?? 'unknown',
    championCount: data.champions.length,
    curveCount: countCurves(data),
    matched,
    unmatched,
    ambiguous,
    conflicts,
    canWrite: true,
  };
}

export async function importMcocAbilityCurves(
  prisma: PrismaClient,
  data: GameAbilityCurvesFile,
  options: { write?: boolean } = {}
): Promise<McocAbilityCurvesImportReport> {
  const dbChampions = await prisma.champion.findMany({
    select: { id: true, name: true, shortName: true, gameId: true },
  });
  const matches = new Map<string, MatchResult>();

  for (const champion of data.champions) {
    matches.set(
      champion.gameId,
      matchGameChampionIdentity(
        {
          gameId: champion.gameId,
          gameFullName: champion.fullName || champion.gameId,
          gameShortName: champion.shortName ?? '',
        },
        dbChampions as ChampionRecord[]
      )
    );
  }

  const report = summarize(data, matches);
  if (!options.write) return report;

  let deletedCurves = 0;
  let upsertedCurves = 0;

  for (const champion of data.champions) {
    const match = matches.get(champion.gameId);
    if (match?.status !== 'matched') continue;

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.championAbilityCurve.deleteMany({
        where: {
          championId: match.champion.id,
          kind: 'signature',
        },
      });
      deletedCurves += deleted.count;

      for (const curve of champion.curves ?? []) {
        await tx.championAbilityCurve.upsert({
          where: { curveId: curve.curveId },
          update: {
            championId: match.champion.id,
            kind: curve.kind,
            formula: curve.formula,
            params: curve.params as Prisma.InputJsonValue,
            minSig: curve.minSig ?? null,
            maxSig: curve.maxSig ?? null,
          },
          create: {
            championId: match.champion.id,
            curveId: curve.curveId,
            kind: curve.kind,
            formula: curve.formula,
            params: curve.params as Prisma.InputJsonValue,
            minSig: curve.minSig ?? null,
            maxSig: curve.maxSig ?? null,
          },
        });
        upsertedCurves++;
      }
    });
  }

  return {
    ...report,
    written: {
      deletedCurves,
      upsertedCurves,
    },
  };
}
