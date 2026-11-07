import { z } from "zod"
import reviewedEvents from "../data/game-ascension/playable-event-blueprints.json"

/** Identity and source flags only: classification never supplies an ascension path. */
export type AscensionBlueprintIdentity = {
  id: string; gameId: string; rarity: number; userCollection: boolean; isEventCharacter: boolean
}
export type AscensionBlueprintClassification = "collectible" | "verified-playable-event" | "excluded"

const identity = z.string().min(1).refine(value => value === value.trim())
const registry = z.object({
  version: z.literal(1),
  exceptions: z.array(z.object({
    id: identity, gameId: identity, rarity: z.number().int().min(1).max(7),
    userCollection: z.literal(true), isEventCharacter: z.literal(true), rationale: identity,
    evidence: z.object({ auditDocument: identity, officialReleaseNotes: z.url(), bcgSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  }).strict()),
}).strict().parse(reviewedEvents)
if (new Set(registry.exceptions.map(row => row.id)).size !== registry.exceptions.length) throw new Error("Duplicate reviewed ascension event blueprint")

/** Shared with the Python extractor via the reviewed JSON registry. Unknown events stay excluded. */
export function classifyAscensionBlueprint(blueprint: AscensionBlueprintIdentity): AscensionBlueprintClassification {
  if (!blueprint.userCollection) return "excluded"
  if (!blueprint.isEventCharacter) return "collectible"
  return registry.exceptions.some(row => row.id === blueprint.id && row.gameId === blueprint.gameId
    && row.rarity === blueprint.rarity && row.userCollection === blueprint.userCollection && row.isEventCharacter === blueprint.isEventCharacter)
    ? "verified-playable-event" : "excluded"
}
