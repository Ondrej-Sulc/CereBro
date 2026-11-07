import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import sharp from "sharp"
import { createRewardArtworkCatalog, localRewardArtworkSchema, publishedRewardArtworkSchema, rewardArtworkObjectPath,
  rewardArtworkUrl, type PublishedRewardArtwork, type RewardArtworkRole } from "../domain/reward-artwork"

type Storage = { uploadImmutableBuffer(bytes: Buffer, destination: string, contentType: string): Promise<string> }
const checksum = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
type Plan = { url: string; destination: string; sha256: string; width: number; height: number; role: RewardArtworkRole; bytes?: Buffer }

async function verifyImage(bytes: Buffer, plan: Plan) {
  if (checksum(bytes) !== plan.sha256) throw new Error(`Reward artwork hash changed: ${plan.sha256}`)
  const metadata = await sharp(bytes).metadata()
  if (metadata.format !== "webp" || metadata.width !== plan.width || metadata.height !== plan.height) throw new Error(`Reward artwork dimensions or format mismatch: ${plan.sha256}`)
}

export async function validateLocalRewardArtwork(input: unknown, directory: string, bucket: string) {
  const bundle = localRewardArtworkSchema.parse(input)
  const projected = publishedRewardArtworkSchema.parse({ ...bundle, source: { ...bundle.source, bucket },
    assets: bundle.assets.map(({ file: _file, reuseUrl, ...asset }) => ({ ...asset, url: reuseUrl ?? rewardArtworkUrl(bucket, asset) })) })
  createRewardArtworkCatalog(projected)
  const plans = new Map<string, Plan>()
  // Validate every local byte before the first cloud mutation. Paths are exact
  // role/hash names enforced by schema, never arbitrary manifest paths.
  for (const asset of bundle.assets) {
    const url = asset.reuseUrl ?? rewardArtworkUrl(bucket, asset)
    const previous = plans.get(url)
    if (previous) {
      if (previous.width !== asset.width || previous.height !== asset.height) throw new Error("Conflicting reward artwork dimensions")
      continue
    }
    const plan: Plan = { url, destination: rewardArtworkObjectPath(asset), sha256: asset.sha256, width: asset.width, height: asset.height, role: asset.role }
    if (asset.file) {
      plan.bytes = await fs.readFile(path.join(directory, asset.file))
      await verifyImage(plan.bytes, plan)
    }
    plans.set(url, plan)
  }
  return { projected, plans: [...plans.values()] }
}

export async function publishRewardArtwork(input: unknown, directory: string, storage: Storage, bucket: string,
  fetchImage: typeof fetch = fetch, onProgress?: (done: number, total: number) => void): Promise<PublishedRewardArtwork> {
  const { projected, plans } = await validateLocalRewardArtwork(input, directory, bucket)
  const checkPublic = async (plan: Plan) => {
    const response = await fetchImage(plan.url, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`Reward artwork not publicly accessible (${response.status}): ${plan.sha256}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    await verifyImage(bytes, plan)
  }
  // Existing crystal images must be readable and hash-identical before publishing
  // new reward objects; no stale or guessed URL can enter the manifest.
  const reused = plans.filter(plan => !plan.bytes)
  for (let start = 0; start < reused.length; start += 4) await Promise.all(reused.slice(start, start + 4).map(checkPublic))
  const newImages = plans.filter(plan => plan.bytes)
  for (let start = 0; start < newImages.length; start += 4) {
    await Promise.all(newImages.slice(start, start + 4).map(async plan => {
      const url = await storage.uploadImmutableBuffer(plan.bytes!, plan.destination, "image/webp")
      if (url !== plan.url) throw new Error("Unrelated reward artwork cloud URL or bucket")
      await checkPublic(plan)
    }))
    onProgress?.(reused.length + Math.min(start + 4, newImages.length), plans.length)
  }
  return projected
}
