import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { SourceNote } from "./crystal-shared"
import { CrystalPageHeader } from "./crystal-page-header"

it.each([1, 2])("uses correct reward-count grammar for %s categories", rewardCount => {
  const html = renderToStaticMarkup(<CrystalPageHeader name="Relic crystal" rewardCount={rewardCount} observedAt="2026-11-05T14:05:24Z" />)
  expect(html).toContain(`title="${rewardCount} recorded reward ${rewardCount === 1 ? 'category' : 'categories'}"`)
  expect(html).toContain(`</strong>reward ${rewardCount === 1 ? 'type' : 'types'}<`)
})

it("keeps snapshot context in one collapsed About this data disclosure", () => {
  const html = renderToStaticMarkup(<SourceNote observedAt="2026-11-05T14:05:24Z" ratesObservedAt="2026-11-06T10:00:00Z" firstRecordedAt="2026-11-03T09:00:00Z" />)
  expect(html.includes("About this data")).toBe(true)
  expect(html.includes("<details")).toBe(true)
  expect(/<details[^>]*\sopen(?:=|\s|>)/.test(html)).toBe(false)
  expect(html.includes("5 Nov 2026")).toBe(true)
  expect(html.includes("6 Nov 2026")).toBe(true)
  expect(html.includes("3 Nov 2026")).toBe(true)
  expect(html.includes("release date")).toBe(true)
})
