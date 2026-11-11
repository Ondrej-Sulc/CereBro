// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NodeFilterForm } from "./node-filter-form"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))

afterEach(() => { document.body.innerHTML = ""; vi.unstubAllGlobals() })
describe("native GET filter history", () => {
  it("preserves edits while typing, then restores the actual URL filters on Back and pageshow", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1 })
    window.history.replaceState(null, "", "/nodes?q=Disarray&catalog=curated")
    const host = document.createElement("div"); document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () => root.render(<NodeFilterForm className="filters"><input name="q" /><select name="catalog"><option value="all">All</option><option value="curated">Curated</option></select><select name="source"><option value="">Any</option><option value="Link">Linked</option></select></NodeFilterForm>))
      const input = host.querySelector("input")!, catalog = host.querySelector<HTMLSelectElement>('select[name=catalog]')!, source = host.querySelector<HTMLSelectElement>('select[name=source]')!
      expect(input.value).toBe("Disarray"); expect(catalog.value).toBe("curated")
      input.value = "Unsubmitted edit"
      expect(input.value).toBe("Unsubmitted edit")
      window.history.replaceState(null, "", "/nodes?q=Bleed&source=Link")
      await act(async () => window.dispatchEvent(new PopStateEvent("popstate")))
      expect(input.value).toBe("Bleed"); expect(catalog.value).toBe("all"); expect(source.value).toBe("Link")
      window.history.replaceState(null, "", "/nodes")
      await act(async () => window.dispatchEvent(new Event("pageshow")))
      expect(input.value).toBe(""); expect(catalog.value).toBe("all"); expect(source.value).toBe("")
    } finally { await act(async () => root.unmount()) }
  })
})
