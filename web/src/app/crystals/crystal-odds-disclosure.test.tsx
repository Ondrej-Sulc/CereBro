import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { getCrystalOdds } from "@cerebro/core/data/game-crystal-odds"
import { CrystalOddsDisclosure } from "./crystal-odds-disclosure"
import { loadCrystalPageRewards } from "@/lib/data/crystal-page-rewards"

it("summarizes a single exact 100-percent category without the full rates panel", () => {
  const odds = getCrystalOdds("7_star_hero_shard_crystal")!
  const html = renderToStaticMarkup(<CrystalOddsDisclosure odds={odds} compact />)
  expect(html).toContain('aria-label="Guaranteed reward category"')
  expect(html).toContain("7-Star Hero")
  expect(html).toContain("100.00%")
  expect(html).not.toContain('id="opening-odds-title"')
  expect(html).not.toContain("disclosed outcomes")
  expect(html).not.toContain("Search drop-rate rewards")
})

it("retains source group and Featured context in a compact named champion rate", () => {
  const recorded = getCrystalOdds("alliance_crystal")!
  const odds = { ...recorded, groups: [{ ...recorded.groups![0], name: "PRIZE 3", isFeatured: true, rows: [{ ...recorded.groups![0].rows[0], label: "7-Star Jessica Jones", percentValue: "0.03" }] }] }
  const html = renderToStaticMarkup(<CrystalOddsDisclosure odds={odds} compact embedded />)
  expect(html).toContain("Prize 3 · Featured")
  expect(html).toContain("7-Star Jessica Jones")
  expect(html).toContain("0.03%")
  expect(html).toContain("Individual champion odds are not inferred")
})

it.each([
  { percentValue: "50", prefix: undefined },
  { percentValue: "100", prefix: "<" },
])("retains a single uncertain category as a disclosed rate: %j", row => {
  const recorded = getCrystalOdds("alliance_crystal")!
  const odds = { ...recorded, groups: [{ ...recorded.groups![0], rows: [{ ...recorded.groups![0].rows[0], ...row }] }] }
  const html = renderToStaticMarkup(<CrystalOddsDisclosure odds={odds} compact />)
  expect(html).not.toContain("Guaranteed reward category")
  expect(html).toContain('id="opening-odds-title"')
  expect(html).toContain("1 disclosed outcome.")
  expect(html).not.toContain("1 disclosed outcomes")
})

it("shows the real calibrated Alliance percentages without scaling them or claiming champion odds", () => {
  const odds = getCrystalOdds("alliance_crystal")!
  expect(odds.status).toBe("captured")
  const html = renderToStaticMarkup(<CrystalOddsDisclosure odds={odds} />)
  expect(html).toContain("0.05%")
  expect(html).toContain("4.95%")
  expect(html).toContain("30.00%")
  expect(html).toContain("Percentages apply to the listed reward categories")
  expect(html).toContain("Individual champion odds are not inferred")
})

it("keeps Banquet's guaranteed side drops in separate groups instead of summing their rates", () => {
  const odds = getCrystalOdds("greater_banquet_crystal_dec23")!
  expect(odds.status).toBe("captured")
  expect(odds.groups).toHaveLength(3)
  const html = renderToStaticMarkup(<CrystalOddsDisclosure odds={odds} />)
  expect(html.match(/<h3\b/g)).toHaveLength(3)
  expect(html).toContain("100.00%")
  expect(html).not.toContain("300.00%")
})

it("omits the rates section when no disclosure or no usable rate rows are recorded", () => {
  const empty = getCrystalOdds("abyss_7star_sg_mutant_nexus_crystal")!
  expect(empty.status).not.toBe("captured")
  const captured = getCrystalOdds("alliance_crystal")!
  for (const odds of [null, empty, { ...captured, groups: [] }]) {
    expect(renderToStaticMarkup(<CrystalOddsDisclosure odds={odds} />)).toBe("")
  }
})

it("renders the matched game artwork and links crystal prizes to their exact pages", () => {
  const opening = loadCrystalPageRewards("superior_banquet_crystal_dec25")!
  const html = renderToStaticMarkup(<CrystalOddsDisclosure odds={opening.odds} visuals={opening.oddsVisuals} compact />)
  expect(html).toContain("data-odds-reward-artwork")
  expect(html).toContain('href="/crystals/jubilant_crystal_dec25"')
  expect(html).toContain(encodeURIComponent("https://storage.googleapis.com/champion-images/"))
  expect(html).toContain('loading="lazy"')
})

it("retains disclosed zeros, prefixes and the raw precision in rate tooltips", () => {
  const recorded = getCrystalOdds("alliance_crystal")!
  const odds = { ...recorded, groups: [{ ...recorded.groups![0], rows: [
    { ...recorded.groups![0].rows[0], sourceIndex: 0, percentValue: "0" },
    { ...recorded.groups![0].rows[1], sourceIndex: 1, percentValue: "0.000000001", prefix: "<" },
  ] }] }
  const html = renderToStaticMarkup(<CrystalOddsDisclosure odds={odds} />)
  expect(html).toContain("0.00%")
  expect(html).toContain("&lt;1.00e-9%")
  expect(html).toContain("Server-disclosed value: &lt;0.000000001%")
})
