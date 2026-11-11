import { describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { nodeModifierCatalog } from "../../data/game-node-modifiers"
import artwork from "../../data/game-node-modifiers/artwork.json"
import { modifierIcon, modifierIconKey, modifierVersionIconKey, defenderArtwork } from "../../data/game-node-modifiers/artwork"
import { resolveNativeModifierIcon } from "./native-icons"

describe("source-bound modifier artwork", () => {
  it("holds stale and unreviewed definition versions without generic substitution", () => {
    const disarray = nodeModifierCatalog.definitions.find(d => d.id === "pve_disarray")!
    const dice = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    expect(modifierIcon(nodeModifierCatalog, disarray)).toMatch(/^\/node-modifiers\/icons\/.*\.svg$/)
    expect(modifierIcon(nodeModifierCatalog, dice)).toMatch(/^\/node-modifiers\/icons\/.*\.svg$/)
    expect(modifierIcon({ ...nodeModifierCatalog, contentHash: "stale" }, disarray)).toBeUndefined()
    expect(modifierIcon(nodeModifierCatalog, { ...disarray, versions: [{ ...disarray.versions[0], hash: 'unreviewed' }] })).toBeUndefined()
  })
  it("verifies every shipped outline/portrait against its recorded content hash", () => {
    const rows: { src?: string; sha256?: string }[] = [...artwork.icons, ...artwork.portraits]
    for (const row of rows.filter(row => row.src)) {
      const path = new URL(`../../../web/public${row.src}`, import.meta.url)
      expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(row.sha256)
    }
    expect(artwork.icons.filter(i => i.status === 'verified')).toHaveLength(39)
    expect(new Set(artwork.icons.filter(i => i.status === 'verified').map(i => i.src)).size).toBe(24)
  })
  it("keeps verified NPC portrait bindings separate from public champion links", () => {
    expect(defenderArtwork(nodeModifierCatalog, 'hulk')?.public?.href).toBe('/champions/hulk')
    expect(defenderArtwork(nodeModifierCatalog, 'maestro')?.src).toBeTruthy()
    expect(defenderArtwork(nodeModifierCatalog, 'maestro')?.public).toBeNull()
    expect(defenderArtwork(nodeModifierCatalog, 'unresolved')).toBeUndefined()
    expect(defenderArtwork(nodeModifierCatalog, null)).toBeUndefined()
  })
  it("bridges only exact effect/version/catalog identities into the small public icon DTO", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "pve_disarray")!
    const version = definition.versions[0]
    const key = modifierVersionIconKey(definition.id, version.hash, nodeModifierCatalog.contentHash)
    expect(key).toBe(modifierIconKey(nodeModifierCatalog, definition))
    expect(resolveNativeModifierIcon(key)?.src).toBe(modifierIcon(nodeModifierCatalog, definition))
    expect(modifierVersionIconKey('Disarray', version.hash, nodeModifierCatalog.contentHash)).toBeUndefined()
    expect(modifierVersionIconKey(definition.id, 'unreviewed-version', nodeModifierCatalog.contentHash)).toBeUndefined()
    expect(modifierVersionIconKey(definition.id, version.hash, 'stale-catalog')).toBeUndefined()
  })
})
