import { Champion, DuelSource, DuelStatus, Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import Fuse from "fuse.js";

export const DUEL_IMPORT_SOURCES = [
  DuelSource.GUIA_MTC,
  DuelSource.COCPIT,
  DuelSource.MCOCHUB,
] as const;

export type DuelImportSource = (typeof DUEL_IMPORT_SOURCES)[number];

export interface DuelImportSkippedRow {
  rowNumber: number;
  reason: string;
  championName?: string;
  raw?: string[];
}

export interface DuelImportReport {
  source: DuelImportSource;
  processedCount: number;
  activatedCount: number;
  markedOutdatedCount: number;
  skippedArchivedCount: number;
  skippedRows: DuelImportSkippedRow[];
  unmatchedChampions: string[];
  duplicateInputTargets: string[];
}

type DuelImportDbClient = {
  champion: {
    findMany(args: {
      where: { isPlayable: true };
      select: { id: true; name: true; shortName: true };
    }): Promise<Array<Pick<Champion, "id" | "name" | "shortName">>>;
  };
  duel: {
    findMany(args: {
      where: {
        status: DuelStatus;
        source: DuelImportSource;
      };
      select: { championId: true; playerName: true };
    }): Promise<Array<{ championId: number; playerName: string }>>;
    updateMany(args: {
      where: { source: DuelImportSource; status: DuelStatus };
      data: { status: DuelStatus };
    }): Promise<{ count: number }>;
    upsert(args: {
      where: { championId_playerName: { championId: number; playerName: string } };
      update: { rank: string | null; status: DuelStatus; source: DuelImportSource };
      create: {
        championId: number;
        playerName: string;
        rank: string | null;
        status: DuelStatus;
        source: DuelImportSource;
      };
    }): Promise<unknown>;
  };
};

export function isDuelImportSource(source: string): source is DuelImportSource {
  return DUEL_IMPORT_SOURCES.includes(source as DuelImportSource);
}

function parseDuelRows(csvText: string): string[][] {
  return parse(csvText, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];
}

function parseTarget(target: string) {
  const match = target.trim().match(/^(.*?)(?:\s*\((.*)\))?$/);
  if (!match) return null;

  const playerName = match[1]?.trim();
  if (!playerName) return null;

  return {
    playerName,
    rank: match[2]?.trim() || null,
  };
}

function inputTargetKey(championId: number, playerName: string) {
  return `${championId}:${playerName.trim().toLowerCase()}`;
}

export async function importDuelCsv(
  db: DuelImportDbClient | Prisma.TransactionClient,
  csvText: string,
  source: DuelImportSource
): Promise<DuelImportReport> {
  const rows = parseDuelRows(csvText);
  const report: DuelImportReport = {
    source,
    processedCount: 0,
    activatedCount: 0,
    markedOutdatedCount: 0,
    skippedArchivedCount: 0,
    skippedRows: [],
    unmatchedChampions: [],
    duplicateInputTargets: [],
  };

  if (rows.length <= 1) {
    return report;
  }

  const champions = await db.champion.findMany({
    where: { isPlayable: true },
    select: { id: true, name: true, shortName: true },
  });
  const fuse = new Fuse(champions, {
    keys: ["name", "shortName"],
    threshold: 0.2,
    ignoreLocation: true,
  });

  const archivedDuels = await db.duel.findMany({
    where: { status: DuelStatus.ARCHIVED, source },
    select: { championId: true, playerName: true },
  });
  const archivedSet = new Set(
    archivedDuels.map((duel) => inputTargetKey(duel.championId, duel.playerName))
  );
  const outdatedResult = await db.duel.updateMany({
    where: { source, status: DuelStatus.ACTIVE },
    data: { status: DuelStatus.OUTDATED },
  });
  report.markedOutdatedCount = outdatedResult.count;

  const seenInputTargets = new Set<string>();
  const unmatchedChampionSet = new Set<string>();
  const duplicateInputTargetSet = new Set<string>();
  const duplicateInputTargetKeys = new Set<string>();

  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 1;
    const championName = row[0]?.trim();
    const duelTargetsStr = row.slice(1).join(",").trim();

    if (!championName || !duelTargetsStr) {
      report.skippedRows.push({
        rowNumber,
        reason: "Missing champion name or duel targets.",
        championName,
        raw: row,
      });
      continue;
    }

    const champion = fuse.search(championName)[0]?.item;
    if (!champion) {
      unmatchedChampionSet.add(championName);
      report.skippedRows.push({
        rowNumber,
        reason: "Champion not found.",
        championName,
        raw: row,
      });
      continue;
    }

    const targets = duelTargetsStr.split("|").map((target) => target.trim()).filter(Boolean);
    if (targets.length === 0) {
      report.skippedRows.push({
        rowNumber,
        reason: "No duel targets found.",
        championName,
        raw: row,
      });
      continue;
    }

    for (const target of targets) {
      const parsedTarget = parseTarget(target);
      if (!parsedTarget) {
        report.skippedRows.push({
          rowNumber,
          reason: `Could not parse duel target "${target}".`,
          championName,
          raw: row,
        });
        continue;
      }

      const targetKey = inputTargetKey(champion.id, parsedTarget.playerName);
      if (seenInputTargets.has(targetKey)) {
        if (!duplicateInputTargetKeys.has(targetKey)) {
          duplicateInputTargetSet.add(`${champion.name}: ${parsedTarget.playerName}`);
          duplicateInputTargetKeys.add(targetKey);
        }
        continue;
      }
      seenInputTargets.add(targetKey);

      if (archivedSet.has(targetKey)) {
        report.skippedArchivedCount++;
        continue;
      }

      await db.duel.upsert({
        where: {
          championId_playerName: {
            championId: champion.id,
            playerName: parsedTarget.playerName,
          },
        },
        update: {
          rank: parsedTarget.rank,
          status: DuelStatus.ACTIVE,
          source,
        },
        create: {
          championId: champion.id,
          playerName: parsedTarget.playerName,
          rank: parsedTarget.rank,
          status: DuelStatus.ACTIVE,
          source,
        },
      });

      report.processedCount++;
      report.activatedCount++;
    }
  }

  report.unmatchedChampions = [...unmatchedChampionSet].sort((a, b) => a.localeCompare(b));
  report.duplicateInputTargets = [...duplicateInputTargetSet].sort((a, b) => a.localeCompare(b));

  return report;
}
