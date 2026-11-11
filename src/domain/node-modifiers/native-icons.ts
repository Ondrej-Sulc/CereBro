import { nativeModifierIcons } from "./native-icon-registry"
export { nativeModifierIcons }
export type NativeModifierIconKey = typeof nativeModifierIcons[number]["key"]

/** Small public DTO; an icon choice asserts no game-definition identity. */
export interface CuratedNodeModifier {
  id: string; name: string; description: string; iconKey?: string | null
}
export const curatedNodeModifierSelect = { id: true, name: true, description: true, iconKey: true } as const

export function resolveNativeModifierIcon(key: unknown) {
  return typeof key === "string" ? nativeModifierIcons.find(icon => icon.key === key) : undefined
}
export interface ModifierIconEdit {
  id: string
  iconKey: NativeModifierIconKey | null
  expected: { name: string; description: string; iconKey: string | null }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
export function validateModifierIconEdit(input: unknown): ModifierIconEdit {
  if (!record(input) || typeof input.id !== "string" || !input.id || input.id.length > 128) throw new Error("Invalid modifier")
  const icon = resolveNativeModifierIcon(input.iconKey)
  if (input.iconKey !== null && !icon) throw new Error("Choose a registered native icon")
  const expected = input.expected
  if (!record(expected) || typeof expected.name !== "string" || typeof expected.description !== "string" ||
    !(expected.iconKey === null || typeof expected.iconKey === "string")) throw new Error("Refresh the modifier before editing its icon")
  return { id: input.id, iconKey: icon?.key ?? null, expected: { name: expected.name, description: expected.description, iconKey: expected.iconKey } }
}
