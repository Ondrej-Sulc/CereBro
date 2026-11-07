import { expect, it } from "vitest"
import { normalizeRosterAscensionState, resolveRosterAscensionUpdate, rosterAscensionLevels } from "./roster-ascension-state"

it("reads numeric owned levels and legacy booleans into one consistent state", () => {
  expect(normalizeRosterAscensionState({ isAscended: false, ascensionLevel: 2 })).toEqual({ isAscended: true, ascensionLevel: 2 })
  expect(normalizeRosterAscensionState({ isAscended: true, ascensionLevel: 0 })).toEqual({ isAscended: true, ascensionLevel: 1 })
  expect(normalizeRosterAscensionState({})).toEqual({ isAscended: false, ascensionLevel: 0 })
})

it("preserves omitted owned state and synchronizes boolean-only or level-only updates", () => {
  const current = { isAscended: true, ascensionLevel: 2 }
  expect(resolveRosterAscensionUpdate({}, { current, maxLevel: 0 })).toEqual({ ok: true, value: current })
  expect(resolveRosterAscensionUpdate({ isAscended: false }, { current })).toEqual({ ok: true, value: { isAscended: false, ascensionLevel: 0 } })
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 0 }, { current })).toEqual({ ok: true, value: { isAscended: false, ascensionLevel: 0 } })
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 1 }, { current })).toEqual({ ok: true, value: { isAscended: true, ascensionLevel: 1 } })
})

it("keeps true/zero legacy compatibility while rejecting explicit contradictory or fractional writes", () => {
  expect(resolveRosterAscensionUpdate({ isAscended: true, ascensionLevel: 0 }, { maxLevel: 1 })).toEqual({ ok: true, value: { isAscended: true, ascensionLevel: 1 } })
  expect(resolveRosterAscensionUpdate({ isAscended: false, ascensionLevel: 2 })).toMatchObject({ ok: false })
  for (const ascensionLevel of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(resolveRosterAscensionUpdate({ ascensionLevel })).toMatchObject({ ok: false })
})

it("limits new or increased manual levels using known rules and preserves historical observations", () => {
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 1 }, { maxLevel: 0 })).toMatchObject({ ok: false })
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 3 }, { maxLevel: 2 })).toMatchObject({ ok: false })
  const current = { isAscended: true, ascensionLevel: 5 }
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 5 }, { current, maxLevel: 0 })).toEqual({ ok: true, value: current })
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 4 }, { current, maxLevel: 0 })).toEqual({ ok: true, value: { isAscended: true, ascensionLevel: 4 } })
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 6 }, { current, maxLevel: 2 })).toMatchObject({ ok: false })
})

it("allows recording structurally valid owned states when the game rule is unknown", () => {
  expect(resolveRosterAscensionUpdate({ ascensionLevel: 3 }, { maxLevel: null })).toEqual({ ok: true, value: { isAscended: true, ascensionLevel: 3 } })
})

it("shows recorded choices plus an existing historical level without inventing intermediate eligibility", () => {
  expect(rosterAscensionLevels(2)).toEqual([0, 1, 2])
  expect(rosterAscensionLevels(0, 5)).toEqual([0, 5])
  expect(rosterAscensionLevels(null, 3)).toEqual([0, 3])
})
