import { describe, expect, it } from "vitest"
import { additionalNativeGameIcons, gameDefinitionIconKey, resolveNativeGameModifierIcon, type GameIconOverlay } from "./native-game-icons"
import { nativeModifierIcons, validateModifierIconEdit } from "./native-icons"

describe("additional native game glyphs", () => {
  it("registers the finite new set without extending curated choices or accepting arbitrary URLs", () => {
    expect(additionalNativeGameIcons).toHaveLength(204)
    expect(new Set(additionalNativeGameIcons.map(icon => icon.key)).size).toBe(204)
    expect(nativeModifierIcons).toHaveLength(24)
    expect(resolveNativeGameModifierIcon(additionalNativeGameIcons[0].key)?.src).toMatch(/^\/node-modifiers\/v3\/icons\/[a-f0-9]{64}\.svg$/)
    expect(resolveNativeGameModifierIcon(nativeModifierIcons[0].key)).toEqual(nativeModifierIcons[0])
    for (const value of ["__proto__", "https://example.com/icon.svg", "Bleed", null, 4]) expect(resolveNativeGameModifierIcon(value)).toBeUndefined()
    expect(() => validateModifierIconEdit({ id: 'curated', iconKey: additionalNativeGameIcons[0].key, expected: { name: 'Keep', description: 'Original', iconKey: null } })).toThrow('Choose a registered native icon')
  })
  it("requires exact source, definition and complete version identities before applying the additive overlay", () => {
    const record = { id: 'native-id', versionHashes: ['full-version'], iconKey: null }
    const source = { catalogHash: 'catalog', bcgSha256: 'bcg' }
    const overlay: GameIconOverlay = { contract: 'cerebro.node-game-icon-overlay/v3', baseSourceIndexSha256: '9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793', ...source,
      definitions: [{ effectId: 'native-id', versionHashes: ['full-version'], iconKey: additionalNativeGameIcons[0].key }] }
    expect(gameDefinitionIconKey(record, source, overlay)).toBe(additionalNativeGameIcons[0].key)
    expect(gameDefinitionIconKey({ ...record, id: 'Same title' }, source, overlay)).toBeNull()
    expect(gameDefinitionIconKey({ ...record, versionHashes: ['old'] }, source, overlay)).toBeNull()
    expect(gameDefinitionIconKey({ ...record, versionHashes: ['full-version', 'unverified-version'] }, source, overlay)).toBeNull()
    expect(gameDefinitionIconKey(record, source, { ...overlay, bcgSha256: 'other' })).toBeNull()
    expect(gameDefinitionIconKey(record, source, { ...overlay, baseSourceIndexSha256: 'other' })).toBeNull()
    expect(gameDefinitionIconKey(record, source, { ...overlay, definitions: [...overlay.definitions, ...overlay.definitions] })).toBeNull()
    expect(gameDefinitionIconKey(record, source, { ...overlay, definitions: [{ ...overlay.definitions[0], iconKey: 'unregistered' }] })).toBeNull()
    expect(gameDefinitionIconKey({ ...record, iconKey: nativeModifierIcons[0].key }, source, { ...overlay, catalogHash: 'stale' })).toBe(nativeModifierIcons[0].key)
  })
})
