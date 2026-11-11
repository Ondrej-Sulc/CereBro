import { describe, expect, it } from "vitest"
import { nativeModifierIcons, resolveNativeModifierIcon, validateModifierIconEdit } from "./native-icons"

describe("native modifier icon presentation choices", () => {
  it("accepts only registered keys and never treats names, IDs or URLs as icons", () => {
    expect(nativeModifierIcons).toHaveLength(24)
    expect(resolveNativeModifierIcon(nativeModifierIcons[0].key)).toBe(nativeModifierIcons[0])
    for (const key of [null, undefined, 'Disarray', 'pve_disarray', 'ava_ea20', 'https://example.com/icon.svg', '__proto__']) {
      expect(resolveNativeModifierIcon(key)).toBeUndefined()
    }
  })
  it("allows an explicit choice or clearing while retaining exact curated drift guards", () => {
    const input = { id: 'curated-cuid', iconKey: nativeModifierIcons[0].key, expected: { name: 'Curated name', description: 'Original description', iconKey: null } }
    expect(validateModifierIconEdit(input)).toEqual(input)
    expect(validateModifierIconEdit({ ...input, iconKey: null }).iconKey).toBeNull()
    expect(input.expected.description).toBe('Original description')
    expect(() => validateModifierIconEdit({ ...input, iconKey: 'pve_disarray' })).toThrow('Choose a registered native icon')
    expect(() => validateModifierIconEdit({ ...input, expected: null })).toThrow()
  })
})
