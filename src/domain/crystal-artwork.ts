import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const crystalArtworkReferenceSchema = z.object({ source: z.enum(["cdn", "resource"]), reference: z.string().min(1) })
const binding = crystalArtworkReferenceSchema.extend({ role: z.enum(["primary", "banner"]) })
const source = z.object({ gachaSha256: hash, gameMetadataSha256: hash, cdnBaseUrl: z.literal("https://kabam-marvel.shared.mcoc-cdn.net/") })
const image = binding.extend({
  sha256: hash, inputSha256: hash, width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096),
  origin: z.enum(["game-cache", "game-resource", "game-cdn"]).optional(),
})
const missing = z.array(binding.extend({ reason: z.string().min(1) }))
export const localCrystalArtworkSchema = z.object({
  version: z.literal(3), source, assets: z.array(image.extend({ file: z.string() })), missing,
}).superRefine((manifest, context) => {
  manifest.assets.forEach((asset, index) => {
    if (asset.file !== `${asset.role}/${asset.sha256}.webp`) context.addIssue({ code: "custom", path: ["assets", index, "file"], message: "Unrelated local artwork file" })
  })
})
export const publishedCrystalArtworkSchema = z.object({
  version: z.literal(3), source: source.extend({ bucket: z.string().min(3) }),
  assets: z.array(image.extend({ url: z.string().url() })), missing,
}).superRefine((manifest, context) => {
  manifest.assets.forEach((asset, index) => {
    if (asset.url !== crystalArtworkUrl(manifest.source.bucket, asset)) context.addIssue({ code: "custom", path: ["assets", index, "url"], message: "Unrelated cloud artwork URL or bucket" })
  })
})
export type LocalCrystalArtwork = z.infer<typeof localCrystalArtworkSchema>
export type PublishedCrystalArtwork = z.infer<typeof publishedCrystalArtworkSchema>
export type CrystalArtworkBinding = z.infer<typeof binding>

export const crystalArtworkKey = (asset: CrystalArtworkBinding) => JSON.stringify([asset.role, asset.source, asset.reference])
export function crystalArtworkObjectPath(asset: { role: "primary" | "banner"; sha256: string }) {
  if (!/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error("Invalid crystal artwork hash")
  return `crystals/${asset.role}/${asset.sha256}.webp`
}
export const crystalArtworkUrl = (bucket: string, asset: { role: "primary" | "banner"; sha256: string }) =>
  `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${crystalArtworkObjectPath(asset)}`
