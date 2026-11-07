import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { SourceNote } from "./crystal-shared"

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
