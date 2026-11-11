import { beforeEach, describe, expect, it, vi } from "vitest"
const fake = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: { nodeModifier: { findMany: fake.findMany } } }))
import { getPublicCuratedModifiers } from "./public-node-modifiers"
import { clearCache } from "./cache"

describe("public curated catalog read boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); clearCache('public-node-modifiers:', true) })
  it("reads only public legacy fields, caches them and never requests unapplied iconKey", async () => {
    const rows = [{ id: 'kept-cuid', name: 'Curated', description: 'Original' }]
    fake.findMany.mockResolvedValue(rows)
    expect(await getPublicCuratedModifiers()).toEqual(rows)
    expect(await getPublicCuratedModifiers()).toEqual(rows)
    expect(fake.findMany).toHaveBeenCalledTimes(1)
    expect(fake.findMany).toHaveBeenCalledWith({ select: { id: true, name: true, description: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 50001 })
  })
  it("does not cache a failed database read as an empty catalog", async () => {
    fake.findMany.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([{ id: 'one', name: 'One', description: '' }])
    await expect(getPublicCuratedModifiers()).rejects.toThrow('Unavailable')
    expect(await getPublicCuratedModifiers()).toHaveLength(1)
  })
})
