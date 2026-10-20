import { describe, expect, it } from "vitest"
import { summarizeChampionAttackHits } from "./champion-attack-profile"

const attack = (...properties: string[][]) => ({ hits: properties.map(properties => ({ properties })) })

describe("recorded attack hit profile", () => {
  it("counts actual hits across moves rather than weighting all moves equally", () => {
    const profile = summarizeChampionAttackHits([attack(["Physical"]), attack(["Energy"], ["Energy"], ["Energy"])])
    expect(profile.total).toBe(4)
    expect(profile.damage).toEqual({ physical: 1, energy: 3, mixed: 0, other: 0 })
  })

  it("preserves mixed damage and unclassified hits without guessing a damage type", () => {
    const profile = summarizeChampionAttackHits([attack(["Physical", "Energy"], [], ["Projectile"], ["Direct"])])
    expect(profile.damage).toEqual({ physical: 0, energy: 0, mixed: 1, other: 3 })
    expect(Object.values(profile.damage).reduce((a, b) => a + b, 0)).toBe(profile.total)
  })

  it("counts contact and projectile independently and ignores duplicated property tags", () => {
    const profile = summarizeChampionAttackHits([attack(["Physical", "Physical", "Contact", "Contact"], ["Energy", "Projectile", "Contact"])])
    expect(profile).toEqual({ total: 2, damage: { physical: 1, energy: 1, mixed: 0, other: 0 }, contact: 2, projectile: 1 })
  })

  it("handles absent moves and moves without recorded hits", () => {
    expect(summarizeChampionAttackHits([])).toEqual({ total: 0, damage: { physical: 0, energy: 0, mixed: 0, other: 0 }, contact: 0, projectile: 0 })
    expect(summarizeChampionAttackHits([attack()]).total).toBe(0)
  })
})
