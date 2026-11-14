import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const identity = z.string().min(1)
const fileName = identity.refine(value => !/[\\/:]/.test(value))
const reference = identity.refine(value => {
  try { const decoded = decodeURIComponent(value); return !/[:\\?#]/.test(decoded) && !decoded.split("/").includes("..") }
  catch { return false }
}, "Unsafe game artwork reference")
export const rewardArtworkRoleSchema = z.enum(["full", "fragment"])
const keySchema = z.object({ type: identity, data: z.string(), role: rewardArtworkRoleSchema })
const rgbaSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)])
const colorDictionarySchema = z.object({ fileName, sha256: hash, objectSha256: hash, pathId: z.number().int().safe(), paletteSha256: hash }).strict()
const renderTintSchema = z.object({ source: z.enum(["color-dictionary", "blueprint"]), key: identity.optional(), rgba: rgbaSchema,
  blendMode: z.literal("overlay").optional() }).strict()
const inventoryShaderSchema = z.object({ name: z.literal("EBG/UI/OverlayColored"), fileName,
  sha256: hash, objectSha256: z.literal("60d753e9a57e49ea3c53f436c9061571fc1ac90ffc8e69c83af1f4afd3e22d5e"), pathId: z.number().int().safe() }).strict()
export const rewardPaletteSchema = z.object({ version: z.literal(1),
  source: colorDictionarySchema.omit({ paletteSha256: true }).extend({ metadataSha256: hash }).strict(),
  colors: z.record(identity, rgbaSchema),
}).strict()
const materialShaderSchema = inventoryShaderSchema.extend({
  bindingProofSha256: z.literal("7d6c8c80868340a3c215545b7e1ac8f675ed3bde4f94e9b91a49889d363e93a3"),
}).strict()
const bindingSchema = keySchema.extend({ source: z.enum(["cdn", "resource"]), reference,
  registry: z.enum(["gamestore", "evo", "crystal-token", "resource-dispatch", "selectable-reward"]), registryId: z.string(),
  tintApplied: z.boolean(), tintColor: z.string().regex(/^[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$/).optional(), classId: z.string().optional(), renderTint: renderTintSchema.optional(),
})
const imageSchema = bindingSchema.extend({ origin: z.enum(["game-resource", "game-cache", "game-cdn", "published-crystal"]),
  sha256: hash, inputSha256: hash, width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096) })
const missingSchema = bindingSchema.partial().extend({ ...keySchema.shape, reason: identity }).strict()
const sourceSchema = z.object({ observedAt: z.iso.datetime({ offset: true }), gachaSha256: hash, openingCatalogSha256: hash,
  gameMetadataSha256: hash, reusedCrystalManifestSha256: hash, cdnBaseUrl: z.literal("https://kabam-marvel.shared.mcoc-cdn.net/"),
  registries: z.array(z.object({ kind: z.enum(["gacha", "bcg", "gameStore"]), fileName, sha256: hash, bytes: z.number().int().nonnegative() }).strict()),
  metadata: z.array(z.object({ assembly: fileName, sha256: hash }).strict()),
  colorDictionary: colorDictionarySchema.optional(),
  inventoryShader: inventoryShaderSchema.optional(),
  materialShader: materialShaderSchema.optional(),
  selectableRewards: z.object({ catalogSha256: hash, observedAt: z.iso.datetime({ offset: true }), gameAssemblySha256: hash, metadataSha256: hash }).strict().optional(),
}).strict()
function validateRenderTints(manifest: { source: { colorDictionary?: z.infer<typeof colorDictionarySchema>; inventoryShader?: z.infer<typeof inventoryShaderSchema>; materialShader?: z.infer<typeof materialShaderSchema> };
  assets: { type: string; data: string; role: string; registryId: string; reference: string; classId?: string; tintApplied: boolean; registry: string; origin: string; renderTint?: z.infer<typeof renderTintSchema> }[] }, context: z.RefinementCtx) {
  manifest.assets.forEach((asset, index) => {
    const inventory = asset.registry === "gamestore" && asset.type === "inv" && asset.role === "full" && asset.data === asset.registryId &&
      ["inventory/Awaken", "inventory/SkillUp", "inventory/RankUp_Gems", "inventory/RAnkUp_Gems"].includes(asset.reference) && asset.classId &&
      asset.renderTint?.source === "color-dictionary" && asset.renderTint.key === `class_${asset.classId}` && asset.renderTint.blendMode === "overlay" &&
      manifest.source.inventoryShader && manifest.source.inventoryShader.sha256 === manifest.source.colorDictionary?.sha256
    const material = asset.registry === "evo" && ["ebp", "ebpf"].includes(asset.type) && asset.data === asset.registryId &&
      asset.role === (asset.type === "ebpf" ? "fragment" : "full") &&
      asset.renderTint?.blendMode === "overlay" && manifest.source.materialShader &&
      manifest.source.materialShader.sha256 === manifest.source.colorDictionary?.sha256
    if ((asset.registry === "evo" && manifest.source.materialShader && !material) ||
      asset.tintApplied !== Boolean(asset.renderTint) || (asset.renderTint &&
      ((asset.registry !== "evo" && !inventory) || (asset.registry === "evo" && asset.renderTint.blendMode && !material) || asset.origin === "published-crystal")) ||
      (asset.renderTint?.source === "color-dictionary" && (!asset.renderTint.key || !manifest.source.colorDictionary))) {
      context.addIssue({ code: "custom", path: ["assets", index], message: "Incomplete or unrelated reward tint provenance" })
    }
  })
}
function validateSelectorProvenance(manifest: { source: { selectableRewards?: unknown };
  assets: { type: string; data: string; role: string; registry: string; registryId: string }[] }, context: z.RefinementCtx) {
  manifest.assets.forEach((asset, index) => {
    if ((asset.registry === "selectable-reward" || asset.type === "sra") &&
      (!manifest.source.selectableRewards || asset.registry !== "selectable-reward" || asset.type !== "sra" || asset.role !== "full" || asset.data !== asset.registryId)) {
      context.addIssue({ code: "custom", path: ["assets", index], message: "Incomplete or unrelated selector provenance" })
    }
  })
}
const coverageSchema = z.object({ bindings: z.number().int().nonnegative(), resolved: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(), resolvedByType: z.record(z.string(), z.number().int().nonnegative()) }).strict()
export const localRewardArtworkSchema = z.object({ version: z.literal(1), source: sourceSchema,
  assets: z.array(imageSchema.extend({ file: z.string().optional(), reuseUrl: z.string().url().optional() }).strict()),
  missing: z.array(missingSchema), coverage: coverageSchema }).strict().superRefine((manifest, context) => {
  validateRenderTints(manifest, context)
  validateSelectorProvenance(manifest, context)
  manifest.assets.forEach((asset, index) => {
    if ((asset.file === undefined) === (asset.reuseUrl === undefined) ||
      (asset.file && asset.file !== `${asset.role}/${asset.sha256}.webp`) ||
      ((asset.origin === "published-crystal") !== Boolean(asset.reuseUrl))) {
      context.addIssue({ code: "custom", path: ["assets", index], message: "Invalid reward artwork publication source" })
    }
  })
})
export const publishedRewardArtworkSchema = z.object({ version: z.literal(1), source: sourceSchema.extend({ bucket: identity }),
  assets: z.array(imageSchema.extend({ url: z.string().url() }).strict()), missing: z.array(missingSchema), coverage: coverageSchema,
}).strict().superRefine((manifest, context) => {
  validateRenderTints(manifest, context)
  validateSelectorProvenance(manifest, context)
  manifest.assets.forEach((asset, index) => {
    if (asset.url !== rewardArtworkUrl(manifest.source.bucket, asset)) {
      context.addIssue({ code: "custom", path: ["assets", index, "url"], message: "Unrelated reward artwork URL or bucket" })
    }
  })
})
export type RewardArtworkRole = z.infer<typeof rewardArtworkRoleSchema>
export type RewardArtwork = z.infer<typeof publishedRewardArtworkSchema>["assets"][number]
export type PublishedRewardArtwork = z.infer<typeof publishedRewardArtworkSchema>
export type LocalRewardArtwork = z.infer<typeof localRewardArtworkSchema>["assets"][number] & { url: string }
export const rewardArtworkKey = (value: { type: string; data: string; role: RewardArtworkRole }) => JSON.stringify([value.type, value.data, value.role])
export const defaultRewardArtworkRole = (type: string): RewardArtworkRole => type === "gf" || type === "ebpf" ? "fragment" : "full"
export function rewardArtworkObjectPath(asset: { role: RewardArtworkRole; sha256: string; origin?: string }) {
  if (!/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error("Invalid reward artwork content hash")
  return asset.origin === "published-crystal" ? `crystals/primary/${asset.sha256}.webp` : `rewards/${asset.role}/${asset.sha256}.webp`
}
export const rewardArtworkUrl = (bucket: string, asset: { role: RewardArtworkRole; sha256: string; origin?: string }) =>
  `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${rewardArtworkObjectPath(asset)}`

function freeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return
  Object.values(value).forEach(freeze); Object.freeze(value)
}

export function createRewardColorPalette(input: unknown) {
  const palette = rewardPaletteSchema.parse(input)
  freeze(palette)
  return palette
}

/** Separate source-bound sidecar: adding artwork never changes opening evidence. */
export function createRewardArtworkCatalog(input: unknown, expected?: { gachaSha256: string; openingCatalogSha256?: string; colorPalette?: z.infer<typeof rewardPaletteSchema> }) {
  const manifest = publishedRewardArtworkSchema.parse(input)
  if (expected && (expected.gachaSha256 !== manifest.source.gachaSha256 ||
    (expected.openingCatalogSha256 && expected.openingCatalogSha256 !== manifest.source.openingCatalogSha256))) throw new Error("Reward artwork snapshot mismatch")
  const palette = expected?.colorPalette
  if (palette && manifest.source.colorDictionary && (palette.source.sha256 !== manifest.source.colorDictionary.sha256 ||
    palette.source.objectSha256 !== manifest.source.colorDictionary.objectSha256 || palette.source.pathId !== manifest.source.colorDictionary.pathId)) throw new Error("Reward color palette mismatch")
  const images = new Map<string, RewardArtwork>()
  const missing = new Map<string, string>()
  for (const image of manifest.assets) {
    if (palette && image.renderTint?.source === "color-dictionary") {
      const rgba = palette.colors[image.renderTint.key!]
      if (!rgba || rgba.some((value, index) => value !== image.renderTint!.rgba[index])) throw new Error("Reward artwork tint differs from game palette")
    }
    const key = rewardArtworkKey(image)
    if (images.has(key)) throw new Error("Duplicate reward artwork identity")
    freeze(image); images.set(key, image)
  }
  for (const item of manifest.missing) {
    const key = rewardArtworkKey(item)
    if (images.has(key) || missing.has(key)) throw new Error("Duplicate missing reward artwork identity")
    missing.set(key, item.reason)
  }
  if (manifest.coverage.bindings !== images.size + missing.size || manifest.coverage.resolved !== images.size || manifest.coverage.missing !== missing.size) {
    throw new Error("Inconsistent reward artwork coverage")
  }
  freeze(manifest.source); freeze(manifest.coverage)
  const getRewardArtwork = (type: string | null | undefined, data: string | null | undefined, role?: RewardArtworkRole): RewardArtwork | null =>
    type && data != null ? images.get(rewardArtworkKey({ type, data, role: role ?? defaultRewardArtworkRole(type) })) ?? null : null
  return { source: manifest.source, coverage: manifest.coverage, getRewardArtwork,
    getRewardArtworkStatus(type: string, data: string, role = defaultRewardArtworkRole(type)) {
      const asset = getRewardArtwork(type, data, role)
      if (asset) return { status: "resolved" as const, asset }
      const reason = missing.get(rewardArtworkKey({ type, data, role }))
      return reason ? { status: "missing" as const, reason } : { status: "unrecorded" as const }
    } }
}

/** Local immutable corrections use the same native provenance checks as exports. */
export function createLocalRewardArtworkCatalog(input: unknown, expected: { gachaSha256: string; colorPalette: z.infer<typeof rewardPaletteSchema> }) {
  const manifest = localRewardArtworkSchema.parse(input)
  if (manifest.source.gachaSha256 !== expected.gachaSha256) throw new Error("Local reward artwork snapshot mismatch")
  const palette = expected.colorPalette
  if (manifest.source.colorDictionary && (manifest.source.colorDictionary.sha256 !== palette.source.sha256 ||
    manifest.source.colorDictionary.objectSha256 !== palette.source.objectSha256)) throw new Error("Local reward palette mismatch")
  const assets = new Map<string, LocalRewardArtwork>()
  for (const value of manifest.assets) {
    if (value.renderTint?.source === "color-dictionary" &&
      JSON.stringify(palette.colors[value.renderTint.key!]) !== JSON.stringify(value.renderTint.rgba)) throw new Error("Local reward tint mismatch")
    const key = rewardArtworkKey(value)
    if (assets.has(key)) throw new Error("Duplicate local reward artwork identity")
    const image = { ...value, url: value.reuseUrl ?? `/game-rewards/${value.file}` }
    freeze(image); assets.set(key, image)
  }
  if (manifest.coverage.resolved !== assets.size || manifest.coverage.missing !== manifest.missing.length ||
    manifest.coverage.bindings !== assets.size + manifest.missing.length) throw new Error("Local reward coverage mismatch")
  return { source: manifest.source, coverage: manifest.coverage,
    getRewardArtwork(type: string | null | undefined, data: string | null | undefined, role?: RewardArtworkRole) {
      return type && data != null ? assets.get(rewardArtworkKey({ type, data, role: role ?? defaultRewardArtworkRole(type) })) ?? null : null
    } }
}
