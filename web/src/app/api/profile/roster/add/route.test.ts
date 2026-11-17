import { beforeEach, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"
const mocks = vi.hoisted(() => ({ player: vi.fn(), target: vi.fn(), champion: vi.fn(), existing: vi.fn(), upsert: vi.fn(), rule: vi.fn() }))
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user" } }) }))
vi.mock("@/lib/auth-helpers", () => ({ getUserPlayerWithAlliance: mocks.player }))
vi.mock("@/lib/prisma", () => ({ prisma: { player: { findUnique: mocks.target }, champion: { findUnique: mocks.champion }, roster: { findUnique: mocks.existing, upsert: mocks.upsert } } }))
vi.mock("@/lib/logger", () => ({ default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/discord-alert", () => ({ sendErrorToDiscord: vi.fn() }))
vi.mock("@/lib/observability/server", () => ({ captureServerException: vi.fn(), captureServerOperation: vi.fn() }))
vi.mock("@/lib/cache", () => ({ clearCache: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@cerebro/core/data/game-ascension", () => ({ getChampionAscension: mocks.rule, getChampionAscensionRules: () => [] }))
import { POST } from "./route"

beforeEach(() => {
  vi.resetAllMocks()
  mocks.player.mockResolvedValue({ id: "owner", allianceId: null })
  mocks.target.mockResolvedValue({ id: "target", allianceId: "alliance" })
  mocks.champion.mockResolvedValue({ id: 1, gameId: "gwenom", isPlayable: true })
  mocks.existing.mockResolvedValue(null)
  mocks.upsert.mockResolvedValue({ id: "roster", isAscended: true, ascensionLevel: 1, champion: { gameId: "gwenom" } })
  mocks.rule.mockReturnValue({ maxLevel: 2 })
})
const request = (changes: Record<string, unknown> = {}) => new Request("http://localhost/api/profile/roster/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ championId: 1, stars: 7, rank: 3, ...changes }) })

it.each([
  { actor: "owner", player: { id: "owner", allianceId: null }, targetPlayerId: undefined },
  { actor: "officer", player: { id: "owner", allianceId: "alliance", isOfficer: true }, targetPlayerId: "target" },
  { actor: "admin", player: { id: "owner", allianceId: null, isBotAdmin: true }, targetPlayerId: "target" },
])("rejects NPC and legacy champions for an $actor before inspecting or writing a roster", async ({ player, targetPlayerId }) => {
  mocks.player.mockResolvedValue(player)
  for (const obtainable of [[], ["6", "7"]]) {
    mocks.champion.mockResolvedValue({ id: 1, gameId: "npc", isPlayable: false, obtainable })
    const response = await POST(request({ targetPlayerId, isPlayable: true, ascensionLevel: 1 }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Only playable champions can be added to a roster" })
  }
  expect(mocks.champion).toHaveBeenCalledWith({ where: { id: 1 }, select: { gameId: true, isPlayable: true } })
  expect(mocks.existing).not.toHaveBeenCalled()
  expect(mocks.upsert).not.toHaveBeenCalled()
  expect(mocks.rule).not.toHaveBeenCalled()
})

it("keeps a missing champion distinct from an ineligible champion", async () => {
  mocks.champion.mockResolvedValue(null)
  const response = await POST(request())
  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({ error: "Champion not found" })
  expect(mocks.upsert).not.toHaveBeenCalled()
})

it("normalizes legacy and level-only input into consistent stored state", async () => {
  expect((await POST(request({ stars: 6, isAscended: true, ascensionLevel: 0 }))).status).toBe(200)
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ isAscended: true, ascensionLevel: 1 }) }))
  expect((await POST(request({ ascensionLevel: 2 }))).status).toBe(200)
  expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({ isAscended: true, ascensionLevel: 2 }) }))
})

it("rejects contradictions and new levels beyond this champion's recorded eligibility", async () => {
  expect((await POST(request({ isAscended: false, ascensionLevel: 2 }))).status).toBe(400)
  expect((await POST(request({ ascensionLevel: 3 }))).status).toBe(400)
  mocks.rule.mockReturnValue({ maxLevel: 0 })
  expect((await POST(request({ ascensionLevel: 1 }))).status).toBe(400)
  expect(mocks.upsert).not.toHaveBeenCalled()
})

it("preserves an existing owned level when fields are omitted or the historical level is unchanged", async () => {
  mocks.existing.mockResolvedValue({ isAscended: true, ascensionLevel: 5 })
  expect((await POST(request())).status).toBe(200)
  const omitted = mocks.upsert.mock.calls[0][0].update
  expect(omitted).not.toHaveProperty("ascensionLevel")
  expect(omitted).not.toHaveProperty("isAscended")
  expect((await POST(request({ isAscended: true, ascensionLevel: 5 }))).status).toBe(200)
  expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ ascensionLevel: 5, isAscended: true }) }))
})

it("keeps an authorized target player on a unique-conflict retry", async () => {
  mocks.player.mockResolvedValue({ id: "owner", allianceId: "alliance", isOfficer: true })
  mocks.upsert.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("race", { code: "P2002", clientVersion: "test" }))
  expect((await POST(request({ targetPlayerId: "target", ascensionLevel: 1 }))).status).toBe(200)
  expect(mocks.upsert).toHaveBeenCalledTimes(2)
  for (const [args] of mocks.upsert.mock.calls) expect(args.where.playerId_championId_stars.playerId).toBe("target")
  for (const [args] of mocks.existing.mock.calls) expect(args.where.playerId_championId_stars.playerId).toBe("target")
})

it("does not inspect or mutate another player's roster without authorization", async () => {
  expect((await POST(request({ targetPlayerId: "target" }))).status).toBe(403)
  expect(mocks.existing).not.toHaveBeenCalled()
  expect(mocks.upsert).not.toHaveBeenCalled()
})

it("keeps missing eligibility distinct from an explicit zero cap and validates integers", async () => {
  mocks.rule.mockReturnValue(null)
  expect((await POST(request({ ascensionLevel: 3 }))).status).toBe(200)
  mocks.upsert.mockClear()
  expect((await POST(request({ ascensionLevel: 1.5 }))).status).toBe(400)
  expect(mocks.upsert).not.toHaveBeenCalled()
})
