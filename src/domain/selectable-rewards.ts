import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const id = z.string().regex(/^[a-f0-9]{24}$/)
const reference = z.string().min(1).refine(value => {
  try {
    const decoded = decodeURIComponent(value)
    return !/[:\\?#]/.test(decoded) && !decoded.startsWith("/") && !decoded.split("/").includes("..")
  } catch { return false }
})
export const selectableRewardSchema = z.object({ id, name: z.string().min(1), description: z.string(),
  icon: z.object({ source: z.enum(["cdn", "resource"]), reference }).strict().nullable() }).strict()
const catalogSchema = z.object({ version: z.literal(1), source: z.object({ observedAt: z.iso.datetime({ offset: true }),
  captureMethod: z.literal("read-only-game-definition-registry"), gameAssemblySha256: hash, metadataSha256: hash,
  openingCatalogSha256: hash }).strict(), selectors: z.array(selectableRewardSchema), missingIds: z.array(id) }).strict()

/** Metadata only: selector choices are separate from direct crystal prize membership. */
export function createSelectableRewardCatalog(input: unknown, expectedOpeningCatalogSha256?: string) {
  const catalog = catalogSchema.parse(input)
  if (expectedOpeningCatalogSha256 && catalog.source.openingCatalogSha256 !== expectedOpeningCatalogSha256) {
    throw new Error("Selector opening snapshot mismatch")
  }
  const byId = new Map<string, z.infer<typeof selectableRewardSchema>>()
  for (const selector of catalog.selectors) {
    if (byId.has(selector.id)) throw new Error("Duplicate selector identity")
    if (selector.icon) Object.freeze(selector.icon)
    byId.set(selector.id, Object.freeze(selector))
  }
  const missing = new Set<string>()
  for (const id of catalog.missingIds) {
    if (byId.has(id) || missing.has(id)) throw new Error("Duplicate selector identity")
    missing.add(id)
  }
  return { source: Object.freeze(catalog.source),
    getSelectableReward: (id: string) => byId.get(id) ?? null }
}
