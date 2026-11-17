import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ ensureAdmin: vi.fn(), findUnique: vi.fn(), update: vi.fn(), revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findUnique: mocks.findUnique, update: mocks.update } } }))
vi.mock("../actions", () => ({ ensureAdmin: mocks.ensureAdmin }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: vi.fn() }))
vi.mock("@/lib/with-request-context", () => ({ withActionContext: (_name: string, handler: unknown) => handler }))
vi.mock("@cerebro/core/services/openRouterService", () => ({ OpenRouterService: vi.fn() }))
vi.mock("@/lib/ability-draft-service", () => ({ generateAbilityDraft: vi.fn(), saveAbilityDraft: vi.fn() }))
vi.mock("@cerebro/core/services/mcocGameTagsImportService", () => ({ importMcocGameTags: vi.fn(), parseMcocChampionTagsJson: vi.fn(), parseMcocGameTagsJson: vi.fn(), parseMcocHeroTiersJson: vi.fn() }))

import { updateChampionDetails } from "./actions"

const details = { name: "Collector", shortName: "Collector", class: "COSMIC", obtainable: [] }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.findUnique.mockResolvedValue({ isPlayable: false })
})

it("preserves an unknown NPC release date when editing champion details", async () => {
  await updateChampionDetails(1, { ...details, releaseDate: null })
  expect(mocks.ensureAdmin).toHaveBeenCalledWith("MANAGE_CHAMPIONS")
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ...details, slug: "collector", releaseDate: null } })
})

it("still requires a release date for playable champions", async () => {
  mocks.findUnique.mockResolvedValue({ isPlayable: true })
  await expect(updateChampionDetails(1, { ...details, releaseDate: null })).rejects.toThrow("Release date is required for playable champions")
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.revalidatePath).not.toHaveBeenCalled()
})

it("keeps known playable release dates unchanged", async () => {
  mocks.findUnique.mockResolvedValue({ isPlayable: true })
  const releaseDate = new Date("2014-12-10T00:00:00Z")
  await updateChampionDetails(1, { ...details, releaseDate })
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ releaseDate }) }))
})

it("rejects invalid dates and missing champions without writing", async () => {
  await expect(updateChampionDetails(1, { ...details, releaseDate: new Date("invalid") })).rejects.toThrow("Invalid release date")
  mocks.findUnique.mockResolvedValue(null)
  await expect(updateChampionDetails(999, { ...details, releaseDate: null })).rejects.toThrow("Champion not found")
  expect(mocks.update).not.toHaveBeenCalled()
})
