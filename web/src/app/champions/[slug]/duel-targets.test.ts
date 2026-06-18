import { describe, expect, it } from "vitest"
import {
  getExternalDuelSourceCredits,
  getDuelSourceLabel,
  prepareDuelTargets,
  type DuelTargetInput,
} from "./duel-targets"

function duel(overrides: Partial<DuelTargetInput>): DuelTargetInput {
  return {
    id: overrides.id ?? 1,
    playerName: overrides.playerName ?? "Target",
    rank: overrides.rank ?? null,
    status: overrides.status ?? "ACTIVE",
    source: overrides.source ?? "USER_SUGGESTION",
    updatedAt: overrides.updatedAt ?? "2026-06-18T00:00:00.000Z",
  }
}

describe("duel target display helpers", () => {
  it("sorts active duels before outdated duels", () => {
    const result = prepareDuelTargets([
      duel({ id: 1, playerName: "Outdated", status: "OUTDATED" }),
      duel({ id: 2, playerName: "Active", status: "ACTIVE" }),
    ])

    expect(result.targets.map((target) => target.playerName)).toEqual(["Active", "Outdated"])
  })

  it("sorts player names alphabetically within each status group", () => {
    const result = prepareDuelTargets([
      duel({ id: 1, playerName: "Zed", status: "ACTIVE" }),
      duel({ id: 2, playerName: "alpha", status: "ACTIVE" }),
      duel({ id: 3, playerName: "Omega", status: "OUTDATED" }),
      duel({ id: 4, playerName: "beta", status: "OUTDATED" }),
    ])

    expect(result.targets.map((target) => target.playerName)).toEqual(["alpha", "Zed", "beta", "Omega"])
  })

  it("preserves rank when present", () => {
    const result = prepareDuelTargets([
      duel({ rank: "7R3" }),
    ])

    expect(result.targets[0].rank).toBe("7R3")
  })

  it("includes only present external source credits", () => {
    const credits = getExternalDuelSourceCredits([
      duel({ source: "GUIA_MTC" }),
      duel({ source: "MCOCHUB" }),
    ])

    expect(credits).toEqual([
      { source: "GUIA_MTC", label: "GuiaMTC", url: "https://www.guiamtc.com/" },
      { source: "MCOCHUB", label: "MCOCHUB", url: "https://mcochub.insaneskull.com" },
    ])
  })

  it("does not create external source credits for user suggestions", () => {
    expect(getExternalDuelSourceCredits([
      duel({ source: "USER_SUGGESTION" }),
    ])).toEqual([])
  })

  it("returns empty display groups for an empty duel list", () => {
    const result = prepareDuelTargets([])

    expect(result.targets).toEqual([])
    expect(result.activeTargets).toEqual([])
    expect(result.outdatedTargets).toEqual([])
    expect(result.totalCount).toBe(0)
    expect(result.outdatedCount).toBe(0)
  })

  it("maps source labels", () => {
    expect(getDuelSourceLabel("USER_SUGGESTION")).toBe("User")
    expect(getDuelSourceLabel("GUIA_MTC")).toBe("GuiaMTC")
    expect(getDuelSourceLabel("COCPIT")).toBe("CoCPit")
    expect(getDuelSourceLabel("MCOCHUB")).toBe("MCOCHUB")
  })
})
