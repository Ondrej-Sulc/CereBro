// @vitest-environment jsdom
import { act, type ImgHTMLAttributes } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
vi.mock("next/image", () => ({ default: ({ sizes: _sizes, ...props }: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }))
import { CrystalRewardsBrowser } from "./crystal-rewards-browser"
import { loadCrystalPageRewards } from "@/lib/data/crystal-page-rewards"

it("expands Gold amounts without repeating the resource card or losing prize context", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const element = document.createElement("div")
  document.body.append(element)
  const root = createRoot(element)
  try {
    await act(async () => root.render(<CrystalRewardsBrowser presentation={loadCrystalPageRewards("greater_banquet_crystal_dec22")!.rewardPresentation} />))
    const group = element.querySelector<HTMLDetailsElement>('[data-reward-amounts][data-reward-category="greater_banquet_crystal_gold_dec2022"]')!
    expect(group.open).toBe(false)
    expect(group.querySelector("summary")?.textContent).toContain("4 amount options")
    await act(async () => group.querySelector("summary")!.click())
    expect(group.open).toBe(true)
    expect(Array.from(group.querySelectorAll("li"), row => row.textContent)).toEqual(["×100,000", "×200,000", "×500,000", "×1,000,000"])
    expect(element.querySelectorAll('[data-reward-amounts] summary strong').length).toBeGreaterThan(1)
  } finally {
    await act(async () => root.unmount())
    element.remove(); vi.unstubAllGlobals()
  }
})
