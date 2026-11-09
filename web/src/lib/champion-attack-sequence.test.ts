import { describe, expect, it } from "vitest"
import { describeChampionAttackHit, groupChampionAttackHits } from "./champion-attack-profile"

describe("attack hit presentation", () => {
  it("keeps both damage and delivery dimensions independent, including combinations", () => {
    expect(describeChampionAttackHit(["Projectile", "Physical", "Contact", "Energy", "Punch"]))
      .toEqual({ damage: ["Physical", "Energy"], delivery: ["Contact", "Projectile"], other: ["Punch"] })
    expect(describeChampionAttackHit(["Projectile", "Physical"]))
      .toEqual({ damage: ["Physical"], delivery: ["Projectile"], other: [] })
  })

  it("does not infer missing properties or lose unknown tags", () => {
    expect(describeChampionAttackHit(["", " ", "Psychic", "Psychic"]))
      .toEqual({ damage: [], delivery: [], other: ["Psychic"] })
    expect(describeChampionAttackHit(["Energy"])).toEqual({ damage: ["Energy"], delivery: [], other: [] })
    expect(describeChampionAttackHit(["Contact"])).toEqual({ damage: [], delivery: ["Contact"], other: [] })
  })

  it("groups only adjacent identical hits and preserves exact positions and source input", () => {
    const hits = [
      { properties: ["Physical", "Contact"] }, { properties: ["Contact", "Physical", "Physical"] },
      { properties: ["Energy", "Projectile"] }, { properties: ["Physical", "Contact"] },
      { properties: ["Physical", "Contact", "Punch"] }, { properties: [] },
    ]
    const original = structuredClone(hits)
    expect(groupChampionAttackHits(hits)).toEqual([
      { start: 1, end: 2, damage: ["Physical"], delivery: ["Contact"], other: [] },
      { start: 3, end: 3, damage: ["Energy"], delivery: ["Projectile"], other: [] },
      { start: 4, end: 4, damage: ["Physical"], delivery: ["Contact"], other: [] },
      { start: 5, end: 5, damage: ["Physical"], delivery: ["Contact"], other: ["Punch"] },
      { start: 6, end: 6, damage: [], delivery: [], other: [] },
    ])
    expect(hits).toEqual(original)
  })

  it("handles absent and long homogeneous sequences without manufacturing hits", () => {
    expect(groupChampionAttackHits([])).toEqual([])
    expect(groupChampionAttackHits(Array.from({ length: 21 }, () => ({ properties: ["Energy", "Projectile"] }))))
      .toEqual([{ start: 1, end: 21, damage: ["Energy"], delivery: ["Projectile"], other: [] }])
  })
})
