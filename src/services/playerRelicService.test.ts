import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  addPlayerRelic,
  updatePlayerRelic,
  removePlayerRelic,
  listPlayerRelics,
} from "./playerRelicService";

const stamp = new Date("2026-10-27T08:00:00Z");
const rarity = {
  relicId: "r",
  sourceRarityId: "t6",
  stars: 6,
  maxRank: 5,
  maxSignature: 200,
  isCurrent: true,
  selectable: true,
  relic: {
    id: "r",
    name: "Test",
    shortName: "Test",
    slug: "test",
    type: "statcast",
    class: "TECH",
    portraitPath: "test.png",
    primaryAttribute: "Armor",
    secondaryAttribute: "Critical Rating",
    isCurrent: true,
    sourceHash: "a",
    importId: "b",
  },
  prestige: {
    sourceDefinitionHash: "a",
    sourcePackageHash: "b",
    ranks: [{ rank: 1, socketRanks: {}, prestigeBySignature: [100, 120] }],
  },
};
function fixture() {
  const row = {
    id: "owned",
    playerId: "p",
    relicId: "r",
    sourceRarityId: "t6",
    rank: 1,
    sigLevel: 0,
    createdAt: stamp,
    updatedAt: stamp,
    rarity: structuredClone(rarity),
  };
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ championPrestige: 10000, relicPrestige: 1000, summonerPrestige: 11000, relicPrestigeFromInventory: false }]),
    gameRelicRarity: { findFirst: vi.fn().mockResolvedValue(row.rarity) },
    playerRelic: {
      create: vi.fn().mockResolvedValue(row),
      findFirst: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue([row]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const db = {
    ...tx,
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaClient;
  return { db, tx, row };
}
describe("player relic inventory", () => {
  it("adds an exact variant/rarity to the authenticated player without touching account prestige", async () => {
    const { db, tx } = fixture();
    const result = await addPlayerRelic(db, "p", {
      relicId: "r",
      stars: 6,
      rank: 1,
      sigLevel: 0,
    });
    expect(tx.playerRelic.create.mock.calls[0][0].data).toEqual({
      playerId: "p",
      relicId: "r",
      sourceRarityId: "t6",
      rank: 1,
      sigLevel: 0,
    });
    expect(result).toMatchObject({ id: "owned", prestige: null }); // incomplete capture must not become an estimate
  });
  it.each([
    { rank: 6, sigLevel: 0 },
    { rank: 1, sigLevel: 201 },
    { rank: 0, sigLevel: 0 },
    { rank: 1.5, sigLevel: 0 },
  ])("rejects invalid builds %j before writing", async (build) => {
    const { db, tx } = fixture();
    await expect(
      addPlayerRelic(db, "p", { relicId: "r", stars: 6, ...build }),
    ).rejects.toThrow();
    expect(tx.playerRelic.create).not.toHaveBeenCalled();
  });
  it("rejects unavailable rarity and retired relics", async () => {
    const { db, tx } = fixture();
    tx.gameRelicRarity.findFirst.mockResolvedValueOnce(null);
    await expect(
      addPlayerRelic(db, "p", { relicId: "r", stars: 4, rank: 1, sigLevel: 0 }),
    ).rejects.toThrow(/available/i);
    expect(tx.playerRelic.create).not.toHaveBeenCalled();
  });
  it("does not overwrite an existing relic on duplicate add", async () => {
    const { db, tx } = fixture();
    tx.playerRelic.create.mockRejectedValue({ code: "P2002" });
    await expect(
      addPlayerRelic(db, "p", { relicId: "r", stars: 6, rank: 1, sigLevel: 0 }),
    ).rejects.toThrow(/already/i);
  });
  it("scopes reads and mutations to the active profile", async () => {
    const { db, tx } = fixture();
    tx.playerRelic.findFirst.mockResolvedValue(null);
    await expect(
      updatePlayerRelic(db, "other", {
        id: "owned",
        updatedAt: stamp.toISOString(),
        rank: 2,
        sigLevel: 0,
      }),
    ).rejects.toThrow(/found/i);
    expect(tx.playerRelic.findFirst.mock.calls[0][0].where).toEqual({
      id: "owned",
      playerId: "other",
    });
    expect(tx.playerRelic.updateMany).not.toHaveBeenCalled();
    await listPlayerRelics(db, "other");
    expect(tx.playerRelic.findMany.mock.calls[0][0].where).toEqual({
      playerId: "other",
    });
  });
  it("rejects stale updates without losing the newer build", async () => {
    const { db, tx } = fixture();
    tx.playerRelic.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updatePlayerRelic(db, "p", {
        id: "owned",
        updatedAt: stamp.toISOString(),
        rank: 2,
        sigLevel: 0,
      }),
    ).rejects.toThrow(/changed/i);
    expect(tx.playerRelic.updateMany.mock.calls[0][0].where).toEqual({
      id: "owned",
      playerId: "p",
      updatedAt: stamp,
    });
  });
  it("scopes removal by owner and version", async () => {
    const { db, tx } = fixture();
    await removePlayerRelic(db, "p", {
      id: "owned",
      updatedAt: stamp.toISOString(),
    });
    expect(tx.playerRelic.deleteMany.mock.calls[0][0].where).toEqual({
      id: "owned",
      playerId: "p",
      updatedAt: stamp,
    });
  });
  it("looks up exact prestige and hides stale source bindings", async () => {
    const { db, row } = fixture();
    row.rarity.maxRank = 1;
    row.rarity.maxSignature = 1;
    expect((await listPlayerRelics(db, "p"))[0].prestige).toBe(100);
    row.rarity.prestige.sourcePackageHash = "stale";
    expect((await listPlayerRelics(db, "p"))[0].prestige).toBeNull();
  });
});
