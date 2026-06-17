import { beforeEach, describe, expect, it } from "vitest";
import { DuelSource, DuelStatus } from "@prisma/client";
import { DuelImportSource, importDuelCsv } from "./duelImportService";

const champions = [
  { id: 1, name: "Wolverine", shortName: "Wolvie" },
  { id: 2, name: "Doctor Doom", shortName: "Doom" },
];

let duels: Array<{
  championId: number;
  playerName: string;
  rank: string | null;
  status: DuelStatus;
  source: DuelImportSource;
}>;

function makeDb() {
  return {
    champion: {
      findMany: async () => champions,
    },
    duel: {
      findMany: async ({ where }: { where: { status: DuelStatus; source: DuelSource } }) =>
        duels
          .filter((duel) => duel.status === where.status && duel.source === where.source)
          .map((duel) => ({ championId: duel.championId, playerName: duel.playerName })),
      updateMany: async ({ where, data }: { where: { source: DuelSource; status: DuelStatus }; data: { status: DuelStatus } }) => {
        let count = 0;
        for (const duel of duels) {
          if (duel.source === where.source && duel.status === where.status) {
            duel.status = data.status;
            count++;
          }
        }
        return { count };
      },
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { championId_playerName: { championId: number; playerName: string } };
        update: { rank: string | null; status: DuelStatus; source: DuelImportSource };
        create: {
          championId: number;
          playerName: string;
          rank: string | null;
          status: DuelStatus;
          source: DuelImportSource;
        };
      }) => {
        const existing = duels.find(
          (duel) =>
            duel.championId === where.championId_playerName.championId &&
            duel.playerName === where.championId_playerName.playerName
        );
        if (existing) {
          existing.rank = update.rank;
          existing.status = update.status;
          existing.source = update.source;
          return existing;
        }

        duels.push(create);
        return create;
      },
    },
  };
}

describe("importDuelCsv", () => {
  beforeEach(() => {
    duels = [
      {
        championId: 1,
        playerName: "Old Target",
        rank: "6R3",
        status: DuelStatus.ACTIVE,
        source: DuelSource.GUIA_MTC,
      },
      {
        championId: 1,
        playerName: "Archived Target",
        rank: null,
        status: DuelStatus.ARCHIVED,
        source: DuelSource.GUIA_MTC,
      },
    ];
  });

  it("parses normal rows and ranks, then marks old active source rows outdated", async () => {
    const csv = "Champion,Duels\nWolverine,New Target (7R3)|Another Target\n";

    const report = await importDuelCsv(makeDb(), csv, DuelSource.GUIA_MTC);

    expect(report.processedCount).toBe(2);
    expect(report.activatedCount).toBe(2);
    expect(report.markedOutdatedCount).toBe(1);
    expect(duels).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Old Target", status: DuelStatus.OUTDATED }),
      expect.objectContaining({ playerName: "New Target", rank: "7R3", status: DuelStatus.ACTIVE }),
      expect.objectContaining({ playerName: "Another Target", rank: null, status: DuelStatus.ACTIVE }),
    ]));
  });

  it("parses quoted CSV target lists with commas", async () => {
    const csv = 'Champion,Duels\n"Doctor Doom","Quoted, Target (6R5)|Second Target"\n';

    const report = await importDuelCsv(makeDb(), csv, DuelSource.GUIA_MTC);

    expect(report.processedCount).toBe(2);
    expect(duels).toEqual(expect.arrayContaining([
      expect.objectContaining({ championId: 2, playerName: "Quoted, Target", rank: "6R5" }),
      expect.objectContaining({ championId: 2, playerName: "Second Target" }),
    ]));
  });

  it("skips archived rows for the imported source", async () => {
    const csv = "Champion,Duels\nWolverine,Archived Target|New Target\n";

    const report = await importDuelCsv(makeDb(), csv, DuelSource.GUIA_MTC);

    expect(report.skippedArchivedCount).toBe(1);
    expect(report.processedCount).toBe(1);
    expect(duels.filter((duel) => duel.playerName === "Archived Target")).toHaveLength(1);
  });

  it("upserts incoming rows back to active", async () => {
    const csv = "Champion,Duels\nWolverine,Old Target (7R4)\n";

    const report = await importDuelCsv(makeDb(), csv, DuelSource.GUIA_MTC);

    expect(report.markedOutdatedCount).toBe(1);
    expect(duels).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Old Target", rank: "7R4", status: DuelStatus.ACTIVE }),
    ]));
  });

  it("reports unmatched champions and skipped rows", async () => {
    const csv = "Champion,Duels\nUnknown Champ,Target\nWolverine,\n";

    const report = await importDuelCsv(makeDb(), csv, DuelSource.GUIA_MTC);

    expect(report.processedCount).toBe(0);
    expect(report.unmatchedChampions).toEqual(["Unknown Champ"]);
    expect(report.skippedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowNumber: 2, reason: "Champion not found." }),
      expect.objectContaining({ rowNumber: 3, reason: "Missing champion name or duel targets." }),
    ]));
  });

  it("reports duplicate input targets and only processes the first instance", async () => {
    const csv = "Champion,Duels\nWolverine,New Target|new target|New Target\n";

    const report = await importDuelCsv(makeDb(), csv, DuelSource.GUIA_MTC);

    expect(report.processedCount).toBe(1);
    expect(report.duplicateInputTargets).toEqual(["Wolverine: new target"]);
  });
});
