// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { nativeModifierIcons } from "@cerebro/core/domain/node-modifiers/native-icons"

const fake = vi.hoisted(() => ({ searchModifiers: vi.fn(), updateModifierIcon: vi.fn(), addAllocation: vi.fn(), updateAllocation: vi.fn(), removeAllocation: vi.fn(), copyAllocations: vi.fn(), massCopyAllocations: vi.fn(), refresh: vi.fn(), toast: vi.fn() }))
vi.mock("@/app/admin/nodes/actions", () => fake)
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: fake.refresh }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: fake.toast }) }))
import AdminNodeManagerClient from "../admin/admin-node-manager-client"

describe("admin icon selection independent of war placement", () => {
  let root: Root, host: HTMLDivElement
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  })
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
  it("chooses and saves a searched curated record's icon without adding or replacing an allocation", async () => {
    const modifier = { id: 'curated-record', name: 'Reviewed modifier', description: 'Preserved curated text', iconKey: null }
    const icon = nativeModifierIcons.find(choice => choice.label === 'Dice')!
    fake.searchModifiers.mockResolvedValue([modifier])
    fake.updateModifierIcon.mockResolvedValue({ ...modifier, iconKey: icon.key })
    await act(async () => root.render(<AdminNodeManagerClient initialNodes={[{ id: 1, nodeNumber: 1, description: null, allocations: [] }]} />))
    await act(async () => (host.querySelector('button.font-mono') as HTMLButtonElement).click())
    const search = host.querySelector('input[placeholder="Search modifiers..."]') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Reviewed')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // Exercise the real debounce/effect, then resolve the server-action boundary.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)) })
    const choose = host.querySelector('button[aria-label="Choose icon for Reviewed modifier"]') as HTMLButtonElement
    expect(choose).not.toBeNull()
    await act(async () => choose.click())
    const radio = document.querySelector('input[aria-label="Dice"]') as HTMLInputElement
    await act(async () => radio.click())
    const save = [...document.querySelectorAll('button')].find(button => button.textContent === 'Save icon')!
    await act(async () => save.click())
    expect(fake.updateModifierIcon).toHaveBeenCalledWith({ id: modifier.id, iconKey: icon.key, expected: { name: modifier.name, description: modifier.description, iconKey: null } })
    expect(fake.addAllocation).not.toHaveBeenCalled()
    expect(fake.updateAllocation).not.toHaveBeenCalled()
    expect(fake.removeAllocation).not.toHaveBeenCalled()
    expect(fake.refresh).toHaveBeenCalled()
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Icon saved.')
    expect((document.querySelector('input[aria-label="Dice"]') as HTMLInputElement).checked).toBe(true)
  })
})
