import { expect, it } from "vitest"
import snapshot from "../data/game-ascension/catalog.json"
import { classifyAscensionBlueprint, createChampionAscensionCatalog } from "./champion-ascension"

const carina = snapshot.blueprints.find(row => row.id === "carina_white_t7")!

it("classifies only the exact reviewed collectible event identity, independent of names and tokens", () => {
  expect(classifyAscensionBlueprint(carina)).toBe("verified-playable-event")
  const renamed = { ...carina, name: "renamed" }
  expect(classifyAscensionBlueprint(renamed)).toBe("verified-playable-event")
  for (const overrides of [
    { id: "carina_white_t6", rarity: 6, userCollection: false },
    { id: "carina_white_boss_t7" },
    { id: "future_event_t7", gameId: "future_event" },
    { id: "carina_white_t7_variant" },
    { gameId: "another_character" },
    { rarity: 6 },
    { userCollection: false },
  ]) {
    const variant = { ...carina, ...overrides }
    expect(classifyAscensionBlueprint(variant)).toBe("excluded")
    const data = structuredClone(snapshot)
    data.blueprints = data.blueprints.filter(row => row.id !== carina.id).concat(variant)
    data.coverage.collectibleBlueprints--
    const catalog = createChampionAscensionCatalog(data)
    expect(catalog.getChampionAscensionByBlueprintId(variant.id)).toBeNull()
    expect(catalog.getChampionAscension("carina_white", 7)).toBeNull()
  }
  expect(classifyAscensionBlueprint(snapshot.blueprints.find(row => row.id === "magik_t7")!)).toBe("collectible")
})

it("classifies player identity without synthesizing eligibility or bypassing path validation", () => {
  const data = structuredClone(snapshot)
  const row = data.blueprints.find(row => row.id === carina.id)!
  row.eligibleTierIds = []; row.steps = []; row.maxRecordedLevel = 0
  const catalog = createChampionAscensionCatalog(data)
  expect(catalog.getChampionAscension("carina_white", 7)).toMatchObject({ maxLevel: 0, steps: [] })
  expect(catalog.getChampionAscensionEligibility("carina_white")).toEqual({ ascendableRarities: [], recordedRarities: [7] })
  const invalid = structuredClone(snapshot)
  invalid.blueprints.find(row => row.id === carina.id)!.steps[0].healthBonus = .5
  expect(() => createChampionAscensionCatalog(invalid)).toThrow(/modifier mismatch/)
  const missingCost = structuredClone(snapshot)
  missingCost.blueprints.find(row => row.id === carina.id)!.steps[0].cost = []
  expect(() => createChampionAscensionCatalog(missingCost)).toThrow()
})
