import { beforeEach, expect, it, vi } from "vitest"
const findMany = vi.hoisted(() => vi.fn())
vi.mock("./prismaService.js", () => ({ prisma: { roster: { findMany } } }))
import { getRoster } from "./rosterService"

beforeEach(() => findMany.mockReset())

it("treats positive numeric levels and legacy flags consistently at the roster read boundary", async () => {
  findMany.mockResolvedValue([{ id: "numeric", isAscended: false, ascensionLevel: 2 }, { id: "legacy", isAscended: true, ascensionLevel: 0 }])
  const rows = await getRoster("player", 7, null, true)
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { playerId: "player", stars: 7, OR: [{ ascensionLevel: { gt: 0 } }, { isAscended: true }] } }))
  expect(rows).toEqual([{ id: "numeric", isAscended: true, ascensionLevel: 2 }, { id: "legacy", isAscended: true, ascensionLevel: 1 }])
})

it("requires both a zero level and a false flag for unascended filtering", async () => {
  findMany.mockResolvedValue([])
  await getRoster("player", null, 3, false)
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { playerId: "player", rank: 3, AND: [{ ascensionLevel: { lte: 0 } }, { isAscended: false }] } }))
})
