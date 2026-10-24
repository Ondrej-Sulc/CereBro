import { describe, expect, it } from "vitest"
import { groupSynergySourceDisplay } from "./champion-kit-source-display"
import type { ChampionKitPartnerSources } from "./champion-kit"

const partner = { name: "Gentle", slug: "gentle", images: null }
const row = (stars: number[], owner = [2, 3, 4, 5, 6, 7], label = "Massive Gains"): ChampionKitPartnerSources => ({
  key: `${owner}:${stars}:${label}`, champions: [partner], unique: true, partnerRarities: stars,
  partnerRequirement: `Gentle (${stars.map(star => `${star}★`).join("/")})`,
  links: [{ key: `${owner}:${stars}`, label, synergyId: `card_${owner}_${stars}`, rarities: owner, conditions: ["Gain a Heavy Attack Stun Charge outside Harvest."] }],
})

describe("shared synergy text", () => {
  it("combines same-name star variants while retaining every correlated requirement and destination", () => {
    const rows = [row([5], [2]), row([6], [3]), row([7], [4])]
    const original = structuredClone(rows)
    const display = groupSynergySourceDisplay(rows)
    expect(display).toHaveLength(1)
    expect(display[0].references.map(reference => ({ owner: reference.rarities, partner: reference.partnerRarities, id: reference.synergyId })))
      .toEqual(rows.map(row => ({ owner: row.links[0].rarities, partner: row.partnerRarities, id: row.links[0].synergyId })))
    expect(display[0].references.map(reference => reference.details?.map(detail => detail.text).join(" "))).toEqual(["Champion 2★", "Champion 3★", "Champion 4★"])
    expect(rows).toEqual(original)
  })

  it("supports level names without a dash and keeps the star context with each level", () => {
    const display = groupSynergySourceDisplay([row([5], [7], "Thunderbolts Lv. 1"), row([6], [7], "Thunderbolts Lv. 2")])
    expect(display).toHaveLength(1)
    expect(display[0].family).toBe("Thunderbolts")
    expect(display[0].references.map(reference => reference.variantLabel)).toEqual(["Lv. 1", "Lv. 2"])
  })

  it("keeps a shared level in the heading when only its partner rarity changes", () => {
    const display = groupSynergySourceDisplay([row([5], [7], "Thunderbolts Lv. 3"), row([6, 7], [7], "Thunderbolts Lv. 3")])
    expect(display).toHaveLength(1)
    expect(display[0].family).toBe("Thunderbolts Lv. 3")
    expect(display[0].references.map(reference => reference.variantLabel)).toEqual(["5★", "6★/7★"])
  })

  it("preserves full multi-partner combinations instead of unioning their stars", () => {
    const first = row([5], [7])
    first.champions.push({ name: "Galan", slug: "galan", images: null })
    first.partnerRarities = undefined
    first.partnerRequirement = "Gentle (5★) OR Galan (6★)"
    const second = structuredClone(first)
    second.key = "other-combination"
    second.links[0].synergyId = "other-card"
    second.partnerRequirement = "Gentle (6★) OR Galan (5★)"
    const display = groupSynergySourceDisplay([first, second])
    expect(display).toHaveLength(1)
    expect(display[0].references.map(reference => reference.variantLabel)).toEqual([first.partnerRequirement, second.partnerRequirement])
  })

  it("leaves ambiguous or incomplete partner requirements separate", () => {
    const first = row([5])
    first.champions.push({ name: "Galan", slug: "galan", images: null })
    const second = structuredClone(first)
    second.key = "second"
    expect(groupSynergySourceDisplay([first, second])).toHaveLength(2)
  })

  it("uses the complete synergies view when otherwise indistinguishable variants have different card IDs", () => {
    const first = row([5])
    const second = structuredClone(first)
    second.key = "other"
    second.links[0].synergyId = "other-card"
    const display = groupSynergySourceDisplay([first, second])
    expect(display).toHaveLength(1)
    expect(display[0].references).toHaveLength(1)
    expect(display[0].references[0].synergyId).toBeUndefined()
    expect(second.links[0].synergyId).toBe("other-card")
  })
})
