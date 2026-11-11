import snapshot from "./catalog.json"
import type { NodeModifierCatalog } from "../../domain/node-modifiers/catalog"

/** Independent, read-only sample. Never reconciles NodeModifier by display name. */
export const nodeModifierCatalog: NodeModifierCatalog = snapshot
