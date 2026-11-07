import { expect, it } from "vitest"
import { listCrystalOpenings } from "../game-crystal-openings"
import { getCrystalAvailability, reviewedCrystalAvailabilityIds } from "./availability"

it("binds every reviewed status to an exact recorded opening", () => {
  const ids = new Set(listCrystalOpenings().map(opening => opening.id))
  expect(reviewedCrystalAvailabilityIds.length).toBeGreaterThan(30)
  expect(reviewedCrystalAvailabilityIds.every(id => ids.has(id))).toBe(true)
})

it("separates recurring pools, event windows and old events without inventing sale status", () => {
  expect(getCrystalAvailability("7_star_hero_shard_crystal", "2026-11-06").status).toBe("recurring")
  expect(getCrystalAvailability("7star_nexus_crystal", "2026-11-06").status).toBe("unverified")
  expect(getCrystalAvailability("valiant_empire_of_doom_saga_crystal", "2026-11-06")).toMatchObject({ status: "current_event", source: { kind: "official_announcement" } })
  expect(getCrystalAvailability("prg_9_gold_bty_bx", "2026-11-06").status).toBe("upcoming")
  expect(getCrystalAvailability("superior_banquet_crystal_dec25", "2026-11-06").status).toBe("past_event")
  expect(getCrystalAvailability("greater_banquet_crystal_dec22", "2026-11-06").status).toBe("past_event")
})
