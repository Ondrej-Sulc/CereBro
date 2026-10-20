import { describe, expect, it } from "vitest"
import { readAbilitySource, formatAbilitySource } from "@cerebro/core/domain/ability-source"

describe("effect source metadata", () => {
  it("extracts only leading legacy labels and keeps trigger details", () => {
    expect(readAbilitySource({ source: "Passive, SP2 → 15s, Max 3" })).toEqual({ condition: "SP2 → 15s, Max 3", effectForm: "PASSIVE", effectDirection: "UNKNOWN" })
    expect(readAbilitySource({ source: "Debuff; Gains: Start fight" })).toEqual({ condition: "Start fight", effectForm: "DEBUFF", effectDirection: "GAIN" })
    expect(readAbilitySource({ source: "Passive" }).condition).toBe("")
  })

  it("does not confuse effect form or direction with a condition", () => {
    for (const source of ["When the Opponent gains Buffs", "While a Passive is active", "Buff duration +20%", "Inflicts a Stun after a Heavy Attack"]) {
      expect(readAbilitySource({ source })).toEqual({ condition: source, effectForm: "UNKNOWN", effectDirection: "UNKNOWN" })
    }
  })

  it("keeps opposite form/direction combinations independent", () => {
    expect(readAbilitySource({ source: "SP1", effectForm: "BUFF", effectDirection: "INFLICT" })).toMatchObject({ effectForm: "BUFF", effectDirection: "INFLICT" })
    expect(readAbilitySource({ source: "SP1", effectForm: "DEBUFF", effectDirection: "GAIN" })).toMatchObject({ effectForm: "DEBUFF", effectDirection: "GAIN" })
  })

  it("preserves signature and synergy requirements around legacy metadata", () => {
    expect(readAbilitySource({ source: "Dupe, Passive, SP1 → 15s" })).toEqual({ condition: "Dupe, SP1 → 15s", effectForm: "PASSIVE", effectDirection: "UNKNOWN" })
    expect(readAbilitySource({ source: "Synergy: Team (7★) with Havok — Passive, SP1" })).toEqual({ condition: "Synergy: Team (7★) with Havok — SP1", effectForm: "PASSIVE", effectDirection: "UNKNOWN" })
    expect(readAbilitySource({ source: "Synergy: Team with Havok — Passive" }).condition).toBe("Synergy: Team with Havok")
  })

  it("retains tags in plain-text clients without repeating a legacy label", () => {
    expect(formatAbilitySource({ source: "Passive, SP1", effectDirection: "INFLICT" })).toBe("Passive · Inflicts — SP1")
    expect(formatAbilitySource({ source: null })).toBe("")
  })

  it("preserves ambiguous legacy annotations instead of hiding information", () => {
    expect(readAbilitySource({ source: "Buff, Passive, SP1" })).toEqual({ condition: "Buff, Passive, SP1", effectForm: "UNKNOWN", effectDirection: "UNKNOWN" })
    expect(readAbilitySource({ source: null })).toEqual({ condition: "", effectForm: "UNKNOWN", effectDirection: "UNKNOWN" })
  })
})
