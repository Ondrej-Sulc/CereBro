// @vitest-environment jsdom
import { act, type ImgHTMLAttributes } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
vi.mock("next/image", () => ({ default: ({ sizes, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) => {
  void sizes
  // eslint-disable-next-line @next/next/no-img-element -- DOM boundary for reward rendering.
  return <img alt={alt} {...props} />
} }))
import { CrystalRewardsBrowser } from "./crystal-rewards-browser"
import { CrystalOpeningRules } from "./crystal-reward-cards"
import { loadCrystalPageRewards } from "@/lib/data/crystal-page-rewards"

it("parses the real Grace guarantee colors after substituting each threshold without changing source text", () => {
  const opening = loadCrystalPageRewards("vfh_ghostrider_reyes_all_rider_crystal")!
  const before = JSON.stringify(opening.pity)
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<CrystalOpeningRules opening={opening} />)
  const rules = host.querySelector('section[aria-label="Opening rules"]')!
  expect(rules.textContent).not.toMatch(/\[ea7800\]|\[-\]|\{0\}/)
  const headings = [...rules.querySelectorAll('h3')]
  expect(headings).toHaveLength(3)
  for (const [index, group] of opening.pity!.groups.entries()) {
    const highlighted = [...headings[index].querySelectorAll('span')].find(span => span.style.color === 'rgb(234, 120, 0)')
    expect(highlighted?.textContent).toBe(`NEXT ${group.payoutLimit} CRYSTALS`)
  }
  expect(JSON.stringify(opening.pity)).toBe(before)
  expect(before).toContain('[ea7800]')
})

it("retains emphasis and literal bracket text while escaping HTML in rule descriptions", () => {
  const base = loadCrystalPageRewards("vfh_ghostrider_reyes_all_rider_crystal")!
  const opening = { ...base, conditionalBonuses: [], pity: { ...base.pity!, groups: [{ ...base.pity!.groups[0],
    descriptionTemplate: '', shortDescriptionTemplate: '[ea7800][b]NEXT {0} CRYSTALS[/b][-]\n[i]Only here[/i] [Max 1 Stack] <script>alert(1)</script>',
  }] } }
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<CrystalOpeningRules opening={opening} />)
  const heading = host.querySelector('h3')!
  expect(heading.textContent).toBe('NEXT 120 CRYSTALS\nOnly here [Max 1 Stack] <script>alert(1)</script>')
  expect([...heading.querySelectorAll('span')].some(span => span.style.fontWeight === '700')).toBe(true)
  expect([...heading.querySelectorAll('span')].some(span => span.style.fontStyle === 'italic')).toBe(true)
  expect(host.querySelector('script')).toBeNull()
})

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
