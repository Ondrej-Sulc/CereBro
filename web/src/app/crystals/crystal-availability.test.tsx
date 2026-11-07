import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { getCrystalAvailability } from "@cerebro/core/data/game-crystals/availability"
import { CrystalAvailabilityBadge, CrystalAvailabilitySummary } from "./crystal-availability"

it("shows the original event and its official evidence without calling owned crystals unusable", () => {
  const availability = getCrystalAvailability("greater_banquet_crystal_dec22", "2026-11-06")
  const html = renderToStaticMarkup(<CrystalAvailabilitySummary availability={availability} />)
  expect(html).toContain("Past event")
  expect(html).toContain("2022 Banquet")
  expect(html).toContain("https://forums.playcontestofchampions.com/en/discussion/320919/")
  expect(html).not.toMatch(/unobtainable|cannot be opened|available now/i)
})

it("distinguishes an ongoing event window from a live-stock check and keeps unknown Nexus status neutral", () => {
  const current = renderToStaticMarkup(<CrystalAvailabilitySummary availability={getCrystalAvailability("valiant_empire_of_doom_saga_crystal", "2026-11-06")} />)
  expect(current).toContain("Current event")
  expect(current).toContain("2 Nov 2026")
  expect(current).toContain("10 Feb 2027")
  expect(current).toContain("not a live-stock check")
  const unknown = renderToStaticMarkup(<CrystalAvailabilityBadge availability={getCrystalAvailability("7star_nexus_crystal", "2026-11-06")} />)
  expect(unknown).toContain("Availability unverified")
  expect(unknown).not.toContain("Recurring pool")
})
