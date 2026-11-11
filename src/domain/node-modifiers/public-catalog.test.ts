import { describe, expect, it } from "vitest"
import { browsePublicModifiers, curatedModifierHash, verifyCuratedAssociations } from "./public-catalog"

const curated = [{ id: "curated-one", name: "Same name", description: "Reviewed 20% wording" }, { id: "curated-two", name: "Same name", description: "Original 40% wording" }]
const game = [{ id: "native-one", name: "Same name", text: "Recorded 20% wording", names: ["Same name"], texts: ["Recorded 20% wording"], versionHashes: ["native-version"], sources: ["Local"], targets: ["defender"], assignmentContexts: [{ source: "Local", target: "defender" }], missing: false, questCount: 2 }]
describe("mixed public modifier catalog", () => {
  it("keeps every curated cuid and independent native ID without name joins", () => {
    const page = browsePublicModifiers(curated, game, {})
    expect(page.total).toBe(3)
    expect(new Set(page.items.map(item => item.href)).size).toBe(3)
    expect(page.items.filter(item => item.origin === "curated").map(item => item.href)).toEqual(["/nodes/curated/curated-one", "/nodes/curated/curated-two"])
    expect(page.items.find(item => item.origin === "game")?.href).toBe("/nodes/native-one")
  })
  it("searches names/full wording and preserves source filters, pagination and stable ordering", () => {
    expect(browsePublicModifiers(curated, game, { q: "40%" }).items.map(item => item.id)).toEqual(["curated-two"])
    expect(browsePublicModifiers(curated, game, { catalog: "game", q: "20%" }).total).toBe(1)
    const first = browsePublicModifiers(curated, game, { page: "1" }, 2), second = browsePublicModifiers(curated, game, { page: "2" }, 2)
    expect(first.items).toHaveLength(2); expect(second.items).toHaveLength(1)
    expect([...first.items, ...second.items].map(item => item.href)).toEqual(browsePublicModifiers(curated, game, {}).items.map(item => item.href))
    expect(browsePublicModifiers(curated, game, { page: "-5" }).page).toBe(1)
    expect(browsePublicModifiers(curated, game, { q: "missing" }).total).toBe(0)
  })
  it("accepts only explicit reviewed identity/version/hash associations and preserves unlinked records", () => {
    const binding = { curatedId: "curated-one", effectId: "native-one", versionHash: "native-version", curatedHash: curatedModifierHash(curated[0]) }
    expect(verifyCuratedAssociations(curated, game, [binding])[0].status).toBe("verified")
    expect(verifyCuratedAssociations(curated, game, [{ ...binding, curatedHash: "old" }])[0].status).toBe("curated-drift")
    expect(verifyCuratedAssociations(curated, game, [{ ...binding, versionHash: "old" }])[0].status).toBe("definition-drift")
    expect(verifyCuratedAssociations(curated, game, [{ ...binding, effectId: "Same name" }])[0].status).toBe("missing-definition")
    expect(verifyCuratedAssociations(curated, game, [])).toEqual([])
    expect(browsePublicModifiers(curated, game, { catalog: "curated" }).total).toBe(2)
  })
  it("requires source and target to belong to the same recorded assignment context", () => {
    const mixed = [{ ...game[0], sources: ["Local", "Link"], targets: ["defender", "attacker"], assignmentContexts: [{ source: "Local", target: "defender" }, { source: "Link", target: "attacker" }] }]
    expect(browsePublicModifiers(curated, mixed, { source: "Link", target: "defender" }).total).toBe(0)
    expect(browsePublicModifiers(curated, mixed, { source: "Link", target: "attacker" }).items.map(row => row.id)).toEqual(["native-one"])
  })
})
