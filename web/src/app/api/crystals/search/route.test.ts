import { expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: vi.fn() } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import { GET } from "./route"
import type { searchCrystalOptions } from "@/lib/data/crystals"

it("serves bounded public crystal choices and honors exact star filtering", async () => {
  const response = GET(new NextRequest("https://cerebro.example/api/crystals/search?q=nexus&rarity=7"))
  const result: ReturnType<typeof searchCrystalOptions> = await response.json()
  expect(response.status).toBe(200)
  expect(result.total).toBeGreaterThan(20)
  expect(result.options).toHaveLength(20)
  expect(result.options.every(option => option.rarities.includes(7))).toBe(true)
  expect(response.headers.get("Cache-Control")).toContain("public")
})

it("returns the main pools on an empty search and an empty collection for an unknown name", async () => {
  const main = await GET(new NextRequest("https://cerebro.example/api/crystals/search")).json() as ReturnType<typeof searchCrystalOptions>
  expect(main.options).toHaveLength(11)
  expect(main.options.every(option => option.isMainPool)).toBe(true)
  const empty = await GET(new NextRequest("https://cerebro.example/api/crystals/search?q=no-such-crystal")).json()
  expect(empty).toEqual({ total: 0, options: [] })
})
