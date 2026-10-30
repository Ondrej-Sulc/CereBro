import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";

// Opt in only against a disposable loopback database with the current schema:
// CEREBRO_TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/cerebro_test_defense
// DATABASE_URL=$CEREBRO_TEST_DATABASE_URL pnpm exec prisma db push --skip-generate
const boundary = vi.hoisted(() => ({ prisma: {} }));
const auth = vi.hoisted(() => ({ getUserPlayerWithAlliance: vi.fn() }));
vi.mock("@/lib/prisma", () => boundary);
vi.mock("@/lib/auth-helpers", () => auth);
vi.mock("@/lib/with-request-context", () => ({ withActionContext: (_name: string, fn: unknown) => fn }));
vi.mock("@/lib/alliance-permissions", () => import("../../lib/alliance-permissions"));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache", () => ({ clearCache: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@cerebro/core/config", () => ({ config: { BOT_TOKEN: "test" } }));
vi.mock("@cerebro/core/services/allianceMembershipService", () => import("../../../../src/services/allianceMembershipService"));
vi.mock("@cerebro/core/services/mapImageService", () => ({ MapImageService: {} }));
vi.mock("@/lib/championHelper", () => ({ getChampionImageUrl: vi.fn() }));
vi.mock("@/lib/discord-config-validation", () => ({}));

import { removeMember } from "../actions/alliance";
import { updateDefensePlacement } from "./defense-actions";

const url = process.env.CEREBRO_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) || !parsed.pathname.startsWith("/cerebro_test_")) {
    throw new Error("Concurrency tests require a disposable loopback cerebro_test_ database.");
  }
}
const client = new PrismaClient({ datasourceUrl: url ?? "postgresql://unused@127.0.0.1:1/cerebro_test_unused" });
let afterPlayerLock: (() => Promise<void>) | undefined;
let beforeNextCommit: (() => Promise<void>) | undefined;

Object.assign(boundary.prisma, {
  $transaction: <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => {
    const beforeCommit = beforeNextCommit;
    beforeNextCommit = undefined;
    return client.$transaction(async (tx) => {
      const queryRaw = async <R>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<R> => {
        const rows = await tx.$queryRaw<R>(query, ...values);
        await afterPlayerLock?.();
        return rows;
      };
      const result = await callback(new Proxy(tx, {
        get(target, key, receiver) {
          return key === "$queryRaw" ? queryRaw : Reflect.get(target, key, receiver);
        },
      }));
      await beforeCommit?.();
      return result;
    }, { timeout: 10_000 });
  },
});

function gate() {
  let release = () => {};
  let enter = () => {};
  const released = new Promise<void>((resolve) => { release = resolve; });
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  return { entered, release, hold: async () => { enter(); await released; } };
}

async function waitForBlockedPlayerQuery() {
  await expect.poll(async () => {
    const rows = await client.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
        AND wait_event_type = 'Lock' AND query LIKE ${'%"Player"%'}
    `;
    return rows[0].count;
  }, { timeout: 3000 }).toBeGreaterThan(0);
}

describe.skipIf(!url)("defense assignment and departure on PostgreSQL", () => {
  beforeAll(async () => { await client.$connect(); });
  afterAll(async () => { await client.$disconnect(); });
  beforeEach(async () => {
    afterPlayerLock = undefined;
    beforeNextCommit = undefined;
    await client.warDefensePlacement.deleteMany();
    await client.warDefensePlan.deleteMany();
    await client.player.deleteMany();
    await client.alliance.deleteMany();
    await client.champion.deleteMany();
    await client.warNode.deleteMany();
    await client.alliance.create({ data: { id: "alliance", name: "Test alliance" } });
    await client.player.createMany({ data: [
      { id: "officer", discordId: "test-officer", ingameName: "Officer", allianceId: "alliance", isOfficer: true },
      { id: "departing", discordId: "test-member", ingameName: "Member", allianceId: "alliance" },
    ] });
    await client.champion.create({ data: {
      id: 101, name: "Test champion", shortName: "Test", class: "SCIENCE",
      releaseDate: new Date("2020-01-01"), obtainable: [], images: {}, fullAbilities: {},
    } });
    await client.warNode.createMany({ data: [{ id: 1, nodeNumber: 1 }, { id: 2, nodeNumber: 2 }] });
    await client.warDefensePlan.create({ data: { id: "plan", name: "Test plan", allianceId: "alliance" } });
    await client.warDefensePlacement.create({ data: {
      id: "slot", planId: "plan", nodeId: 1, playerId: "departing", defenderId: 101, starLevel: 7,
    } });
    auth.getUserPlayerWithAlliance.mockResolvedValue({ id: "officer", allianceId: "alliance", isOfficer: true, isBotAdmin: false });
  });

  const targets = ["id", "upsert-update", "upsert-create"] as const;
  function target(mode: typeof targets[number]) {
    return mode === "id" ? { id: "slot" } : { planId: "plan", battlegroup: 1, nodeId: mode === "upsert-create" ? 2 : 1 };
  }

  it.each(targets)("rejects an off-map Big Thing node for %s without changing placements", async (mode) => {
    await client.warDefensePlan.update({ where: { id: 'plan' }, data: { mapType: 'BIG_THING' } });
    await client.warNode.create({ data: { id: 1011, nodeNumber: 11 } });
    if (mode !== 'upsert-create') {
      await client.warDefensePlacement.update({ where: { id: 'slot' }, data: { nodeId: 1011 } });
    }
    const before = await client.warDefensePlacement.findMany();
    const coordinates = mode === 'id' ? { id: 'slot' } : { planId: 'plan', battlegroup: 1, nodeId: 1011 };
    await expect(updateDefensePlacement({ ...coordinates, defenderId: 101 }))
      .rejects.toThrow("Node does not exist on this plan's map.");
    expect(await client.warDefensePlacement.findMany()).toEqual(before);
  });

  it('accepts Big Thing node 10 with a database identity greater than ten', async () => {
    await client.warDefensePlan.update({ where: { id: 'plan' }, data: { mapType: 'BIG_THING' } });
    await client.warNode.create({ data: { id: 1010, nodeNumber: 10 } });
    await updateDefensePlacement({ planId: 'plan', battlegroup: 1, nodeId: 1010, playerId: 'departing', defenderId: 101 });
    const saved = await client.warDefensePlacement.findUniqueOrThrow({
      where: { planId_battlegroup_nodeId: { planId: 'plan', battlegroup: 1, nodeId: 1010 } }, include: { node: true },
    });
    expect(saved.node.nodeNumber).toBe(10);
    expect(saved.defenderId).toBe(101);
  });

  it.each(targets)("cleans the %s assignment if assignment locks first", async (mode) => {
    const lock = gate();
    afterPlayerLock = lock.hold;
    const assignment = updateDefensePlacement({ ...target(mode), playerId: "departing", defenderId: 101, starLevel: 6 });
    let departure: Promise<unknown> | undefined;
    try {
      await lock.entered;
      departure = removeMember("departing");
      await waitForBlockedPlayerQuery();
    } finally {
      lock.release();
      await Promise.allSettled([assignment, departure]);
    }
    await assignment;
    await departure;
    expect(await client.warDefensePlacement.findMany({ where: { playerId: "departing" } })).toEqual([]);
    const slot = await client.warDefensePlacement.findUnique({ where: {
      planId_battlegroup_nodeId: { planId: "plan", battlegroup: 1, nodeId: mode === "upsert-create" ? 2 : 1 },
    } });
    expect(slot).toMatchObject({ playerId: null, defenderId: null, starLevel: null });
  });

  it.each(targets)("rejects the %s assignment if departure locks first", async (mode) => {
    const commit = gate();
    beforeNextCommit = commit.hold;
    const departure = removeMember("departing");
    let assignment: Promise<unknown> | undefined;
    try {
      await commit.entered;
      assignment = updateDefensePlacement({ ...target(mode), playerId: "departing", defenderId: 101, starLevel: 6 });
      await waitForBlockedPlayerQuery();
    } finally {
      commit.release();
      await Promise.allSettled([departure, assignment]);
    }
    await departure;
    await expect(assignment).rejects.toThrow("Player is not a member of this plan's alliance.");
    expect(await client.warDefensePlacement.findMany({ where: { playerId: "departing" } })).toEqual([]);
  });

  it.each(["id", "upsert-update"] as const)("rejects a partial %s edit if another editor reassigns its player", async (mode) => {
    const lock = gate();
    afterPlayerLock = lock.hold;
    const partial = updateDefensePlacement({ ...target(mode), starLevel: 6 });
    try {
      await lock.entered;
      afterPlayerLock = undefined;
      await updateDefensePlacement({ id: "slot", playerId: "officer", starLevel: 5 });
    } finally {
      lock.release();
      await Promise.allSettled([partial]);
    }
    await expect(partial).rejects.toThrow();
    expect(await client.warDefensePlacement.findUnique({ where: { id: "slot" } }))
      .toMatchObject({ playerId: "officer", defenderId: 101, starLevel: 5 });
  });
});
