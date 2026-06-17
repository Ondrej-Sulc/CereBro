import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuelSource, DuelStatus, Prisma } from "@prisma/client";

const prismaFake = vi.hoisted(() => ({
  duel: {
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const authFake = vi.hoisted(() => ({
  requireBotAdmin: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authFake);
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => cacheFake);

import {
  bulkUpdateDuels,
  countMatchingDuels,
  updateDuelDetails,
  updateDuelStatus,
} from "./actions";

describe("admin duel actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authFake.requireBotAdmin.mockResolvedValue({ id: "admin_1" });
    prismaFake.duel.findMany.mockResolvedValue([]);
    prismaFake.duel.updateMany.mockResolvedValue({ count: 0 });
    prismaFake.duel.count.mockResolvedValue(0);
  });

  it("requires MANAGE_CHAMPIONS", async () => {
    authFake.requireBotAdmin.mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(updateDuelStatus({ ids: [1], status: DuelStatus.ACTIVE })).rejects.toThrow("Unauthorized");

    expect(authFake.requireBotAdmin).toHaveBeenCalledWith("MANAGE_CHAMPIONS");
    expect(prismaFake.duel.updateMany).not.toHaveBeenCalled();
  });

  it("updates only selected duel ids after validating transitions", async () => {
    prismaFake.duel.findMany.mockResolvedValueOnce([
      { id: 1, status: DuelStatus.SUGGESTED },
      { id: 2, status: DuelStatus.SUGGESTED },
    ]);
    prismaFake.duel.updateMany.mockResolvedValueOnce({ count: 2 });

    await expect(updateDuelStatus({ ids: [1, 2, 2], status: DuelStatus.ACTIVE }))
      .resolves.toEqual({ success: true, updatedCount: 2 });

    expect(prismaFake.duel.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      select: { id: true, status: true },
    });
    expect(prismaFake.duel.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: { status: DuelStatus.ACTIVE },
    });
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/admin/duels");
  });

  it("updates all duels matching the filter and source status", async () => {
    prismaFake.duel.updateMany.mockResolvedValueOnce({ count: 143 });

    await expect(bulkUpdateDuels({
      filter: { status: "OUTDATED", source: "GUIA_MTC", q: "doom" },
      fromStatus: DuelStatus.OUTDATED,
      toStatus: DuelStatus.ARCHIVED,
    })).resolves.toEqual({ success: true, updatedCount: 143, message: undefined });

    expect(prismaFake.duel.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: DuelStatus.OUTDATED,
        source: DuelSource.GUIA_MTC,
        OR: expect.arrayContaining([
          { playerName: { contains: "doom", mode: "insensitive" } },
          { champion: { name: { contains: "doom", mode: "insensitive" } } },
        ]),
      }),
      data: { status: DuelStatus.ARCHIVED },
    });
  });

  it("counts all matching duels before an all-filtered bulk action", async () => {
    prismaFake.duel.count.mockResolvedValueOnce(212);

    await expect(countMatchingDuels({
      filter: { status: "OUTDATED", source: "COCPIT", q: "" },
      fromStatus: DuelStatus.OUTDATED,
    })).resolves.toBe(212);

    expect(prismaFake.duel.count).toHaveBeenCalledWith({
      where: {
        status: DuelStatus.OUTDATED,
        source: DuelSource.COCPIT,
      },
    });
  });

  it("returns a clear duplicate error when editing creates a duplicate duel", async () => {
    prismaFake.duel.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(updateDuelDetails({
      id: 1,
      championId: 10,
      playerName: "Duplicate",
      rank: null,
      source: DuelSource.USER_SUGGESTION,
      status: DuelStatus.SUGGESTED,
    })).rejects.toThrow("A duel target with this champion and player name already exists.");
  });
});
