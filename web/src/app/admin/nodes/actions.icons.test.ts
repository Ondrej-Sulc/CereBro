import { beforeEach, describe, expect, it, vi } from "vitest"
import { nativeModifierIcons } from "@cerebro/core/domain/node-modifiers/native-icons"

const fake = vi.hoisted(() => ({ auth: vi.fn(), requireBotAdmin: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn(), clearCache: vi.fn() }))
vi.mock("@/auth", () => ({ auth: fake.auth }))
vi.mock("@/lib/auth-helpers", () => ({ requireBotAdmin: fake.requireBotAdmin }))
vi.mock("@/lib/prisma", () => ({ prisma: { nodeModifier: { updateMany: fake.updateMany, findMany: fake.findMany } } }))
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidatePath, revalidateTag: fake.revalidateTag }))
vi.mock("@/lib/cache", () => ({ clearCache: fake.clearCache }))
vi.mock("@/lib/with-request-context", () => ({ withActionContext: (_: string, fn: unknown) => fn }))
import { searchModifiers, updateModifierIcon } from "./actions"

const edit = { id: 'existing-cuid', iconKey: nativeModifierIcons[0].key, expected: { name: 'Reviewed name', description: 'Curated description', iconKey: null } }
describe("curated modifier icon action", () => {
  beforeEach(() => { vi.resetAllMocks(); fake.requireBotAdmin.mockResolvedValue({}); fake.updateMany.mockResolvedValue({ count: 1 }) })
  it("guards the existing permission before any mutation", async () => {
    fake.requireBotAdmin.mockRejectedValue(new Error('Forbidden'))
    await expect(updateModifierIcon(edit)).rejects.toThrow('Forbidden')
    expect(fake.updateMany).not.toHaveBeenCalled()
    expect(fake.requireBotAdmin).toHaveBeenCalledWith('MANAGE_WAR_CONFIG')
  })
  it("rejects URLs, game IDs and unknown choices at the server boundary", async () => {
    for (const key of ['pve_disarray', 'Disarray', 'https://example.com/icon.svg', '__proto__']) await expect(updateModifierIcon({ ...edit, iconKey: key })).rejects.toThrow('Choose a registered native icon')
    expect(fake.updateMany).not.toHaveBeenCalled()
  })
  it("updates only presentation with exact curated drift guards and invalidates readers", async () => {
    expect(await updateModifierIcon(edit)).toEqual({ id: edit.id, name: edit.expected.name, description: edit.expected.description, iconKey: edit.iconKey })
    expect(fake.updateMany).toHaveBeenCalledWith({ where: { id: edit.id, ...edit.expected }, data: { iconKey: edit.iconKey } })
    expect(fake.clearCache).toHaveBeenCalledWith('war-nodes-', true)
    expect(fake.revalidatePath).toHaveBeenCalledWith('/planning', 'layout')
    expect(fake.revalidatePath).toHaveBeenCalledWith('/admin/quests', 'layout')
  })
  it("clears explicitly and refuses stale name/description/previous-icon snapshots", async () => {
    await updateModifierIcon({ ...edit, iconKey: null })
    expect(fake.updateMany.mock.calls[0][0].data).toEqual({ iconKey: null })
    fake.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(updateModifierIcon(edit)).rejects.toThrow('This modifier changed')
    expect(fake.updateMany).toHaveBeenCalledTimes(2)
  })
  it("includes the finite presentation key in authenticated modifier search DTOs", async () => {
    fake.auth.mockResolvedValue({ user: { id: 'admin' } }); fake.findMany.mockResolvedValue([])
    await searchModifiers('Reviewed')
    expect(fake.findMany.mock.calls[0][0].select).toEqual({ id: true, name: true, description: true, iconKey: true })
  })
})
