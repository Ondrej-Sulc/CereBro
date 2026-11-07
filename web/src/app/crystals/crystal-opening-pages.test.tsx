import { renderToStaticMarkup } from "react-dom/server"
import type { ImgHTMLAttributes } from "react"
import { expect, it, vi } from "vitest"
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} /> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
import { loadCrystalOpening } from "@/lib/data/crystal-openings"
import { CrystalOpeningDetail } from "./crystal-opening-detail"

it("renders the exact Banquet edition's mixed reward categories without inventing drop counts or dates", () => {
  const data = loadCrystalOpening("superior_banquet_crystal_dec25")!
  const html = renderToStaticMarkup(<CrystalOpeningDetail data={data} />)
  expect(html).toContain("Dec 2025")
  expect(html).toContain("superior_banquet_crystal_catalysts_dec2025")
  expect(html).toContain("superior_banquet_crystal_gold_iso_dec2025")
  expect(html).toContain("superior_banquet_crystal_jubilant_crystal_grace")
  expect(html).toContain("Rewards &amp; drop rates")
  expect(html).toContain('href="/crystals/jubilant_crystal_dec25"')
  expect(html).toContain("data-reward-artwork")
  expect(html).toContain("https://storage.googleapis.com/champion-images/rewards/")
  expect(html).not.toContain("/crystals/openings/")
  expect(html).toContain("Tier 3 Alpha Catalyst")
  expect(html).toContain("Gold")
  expect(html).not.toContain("<strong>sc</strong>")
  expect(html).toContain("WITHIN 15 CRYSTALS")
  expect(html).toContain('href="#opening-rules"')
  expect(html).toContain('id="opening-rules"')
  expect(html).not.toContain("{0}")
  expect(html).not.toContain("One reward")
  expect(html).not.toContain("Released")
  expect(html).not.toContain("Game version")
})

it("omits an empty rate section and keeps data notes within the reward crystal header", () => {
  const data = loadCrystalOpening("greater_banquet_crystal_dec22")!
  expect(data.odds?.status).not.toBe("captured")
  const html = renderToStaticMarkup(<CrystalOpeningDetail data={data} />)
  expect(html.includes("Rates captured")).toBe(false)
  expect(html.includes('id="opening-odds-title"')).toBe(false)
  expect(html.includes("returned no rate table")).toBe(false)
  expect(html.indexOf('aria-label="About this data"')).toBeLessThan(html.indexOf("</header>"))
})
