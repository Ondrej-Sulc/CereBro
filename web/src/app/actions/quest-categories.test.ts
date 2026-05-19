import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  questCategory: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const authFake = vi.hoisted(() => ({
  requireBotAdmin: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

const gcsFake = vi.hoisted(() => ({
  deleteFromGcs: vi.fn(),
  uploadToGcs: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authFake);
vi.mock("@/lib/gcs", () => gcsFake);
vi.mock("@/lib/logger", () => ({ default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => cacheFake);

import {
  createQuestCategory,
  updateQuestCategory,
  uploadQuestCategoryThumbnail,
} from "./quest-categories";

describe("quest category actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authFake.requireBotAdmin.mockResolvedValue({ id: "admin_1" });
  });

  it("creates a category and invalidates category consumers", async () => {
    prismaFake.questCategory.create.mockResolvedValueOnce({ id: "cat_1" });

    await expect(createQuestCategory("Story", 3, "parent_1")).resolves.toEqual({ success: true });

    expect(authFake.requireBotAdmin).toHaveBeenCalledWith("MANAGE_QUESTS");
    expect(prismaFake.questCategory.create).toHaveBeenCalledWith({
      data: { name: "Story", order: 3, parentId: "parent_1" },
    });
    expect(cacheFake.revalidateTag).toHaveBeenCalledWith("quest-categories", "default");
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/admin/quests");
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/planning/quests");
  });

  it("rejects category parent cycles before updating", async () => {
    prismaFake.questCategory.findUnique
      .mockResolvedValueOnce({ parentId: "root" })
      .mockResolvedValueOnce({ parentId: "cat_1" });

    await expect(updateQuestCategory("cat_1", { parentId: "child_1" }))
      .rejects.toThrow("Setting this parent would create a circular reference.");

    expect(prismaFake.questCategory.update).not.toHaveBeenCalled();
  });

  it("uploads a thumbnail, stores its URL, and deletes the previous GCS object", async () => {
    vi.setSystemTime(new Date("2026-05-19T10:00:00.000Z"));
    prismaFake.questCategory.findUnique.mockResolvedValueOnce({
      id: "cat_1",
      thumbnailUrl: "https://storage.googleapis.com/cerebro-bucket/quest-category-thumbnails/old.png",
    });
    gcsFake.uploadToGcs.mockResolvedValueOnce("https://cdn.example/new.png");
    prismaFake.questCategory.update.mockResolvedValueOnce({ id: "cat_1" });

    const formData = new FormData();
    formData.set("file", new File(["image-bytes"], "AQ Boss!.png", { type: "image/png" }));

    await expect(uploadQuestCategoryThumbnail("cat_1", formData))
      .resolves.toEqual({ success: true, url: "https://cdn.example/new.png" });

    expect(Buffer.isBuffer(gcsFake.uploadToGcs.mock.calls[0][0])).toBe(true);
    expect(gcsFake.uploadToGcs).toHaveBeenCalledWith(
      expect.anything(),
      "quest-category-thumbnails/cat_1-1779184800000-AQ_Boss_png",
      "image/png",
    );
    expect(prismaFake.questCategory.update).toHaveBeenCalledWith({
      where: { id: "cat_1" },
      data: { thumbnailUrl: "https://cdn.example/new.png" },
    });
    expect(gcsFake.deleteFromGcs).toHaveBeenCalledWith("quest-category-thumbnails/old.png");
    vi.useRealTimers();
  });

  it("deletes a newly uploaded thumbnail if the database update fails", async () => {
    prismaFake.questCategory.findUnique.mockResolvedValueOnce({ id: "cat_1", thumbnailUrl: null });
    gcsFake.uploadToGcs.mockResolvedValueOnce("https://cdn.example/new.png");
    prismaFake.questCategory.update.mockRejectedValueOnce(new Error("db failed"));

    const formData = new FormData();
    formData.set("file", new File(["image-bytes"], "thumb.webp", { type: "image/webp" }));

    await expect(uploadQuestCategoryThumbnail("cat_1", formData)).rejects.toThrow("db failed");

    expect(gcsFake.deleteFromGcs).toHaveBeenCalledWith(expect.stringMatching(/^quest-category-thumbnails\/cat_1-/));
  });
});
