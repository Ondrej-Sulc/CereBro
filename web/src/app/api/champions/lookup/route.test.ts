import { beforeEach, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany } } }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));

import { GET } from "./route";

beforeEach(() => { findMany.mockReset(); });

it("serves only public names and real detail slugs from the lightweight canonical query", async () => {
  findMany.mockResolvedValue([
    { name: "Ghost Rider (Robbie Reyes)", slug: "ghost-rider-robbie-reyes", fullAbilities: "not public payload" },
    { name: "No route", slug: "" },
    { name: "Missing route", slug: null },
  ]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("public");
  expect(await response.json()).toEqual([{ name: "Ghost Rider (Robbie Reyes)", slug: "ghost-rider-robbie-reyes" }]);
  expect(findMany).toHaveBeenCalledWith({
    where: { isPlayable: true, slug: { not: null, notIn: [""] } },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });
});

it("returns an empty lookup for an empty catalog and a retryable private failure response", async () => {
  findMany.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("database credentials must stay private"));
  expect(await (await GET()).json()).toEqual([]);
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Champion search is unavailable" });
});
