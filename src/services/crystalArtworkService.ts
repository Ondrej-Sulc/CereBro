import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { crystalArtworkObjectPath, crystalArtworkUrl, localCrystalArtworkSchema, publishedCrystalArtworkSchema, type PublishedCrystalArtwork } from "../domain/crystal-artwork"

type ArtworkStorage = { uploadImmutableBuffer(bytes: Buffer, destination: string, contentType: string): Promise<string> }
const checksum = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

export async function publishCrystalArtwork(input: unknown, directory: string, storage: ArtworkStorage, bucket: string,
  fetchImage: typeof fetch = fetch, onProgress?: (completed: number, total: number) => void): Promise<PublishedCrystalArtwork> {
  const bundle = localCrystalArtworkSchema.parse(input)
  const plans = new Map<string, { destination: string; bytes: Buffer; sha256: string; role: "primary" | "banner" }>()
  // Validate every byte before any external publication. Local paths are constrained
  // to role/hash by the package schema, including on Windows.
  for (const asset of bundle.assets) {
    const destination = crystalArtworkObjectPath(asset)
    if (plans.has(destination)) continue
    const bytes = await fs.readFile(path.join(directory, asset.file))
    if (checksum(bytes) !== asset.sha256) throw new Error(`Artwork hash changed: ${asset.role}/${asset.sha256}`)
    plans.set(destination, { destination, bytes, sha256: asset.sha256, role: asset.role })
  }
  const entries = [...plans.values()]
  for (let start = 0; start < entries.length; start += 4) {
    await Promise.all(entries.slice(start, start + 4).map(async plan => {
      const expected = crystalArtworkUrl(bucket, plan)
      const url = await storage.uploadImmutableBuffer(plan.bytes, plan.destination, "image/webp")
      if (url !== expected) throw new Error(`Unrelated cloud artwork URL or bucket: ${plan.destination}`)
      const response = await fetchImage(url, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error(`Cloud artwork not publicly accessible: ${plan.destination} (${response.status})`)
      if (checksum(new Uint8Array(await response.arrayBuffer())) !== plan.sha256) throw new Error(`Public artwork hash mismatch: ${plan.destination}`)
    }))
    onProgress?.(Math.min(start + 4, entries.length), entries.length)
  }
  return publishedCrystalArtworkSchema.parse({
    version: 3, source: { ...bundle.source, bucket }, missing: bundle.missing,
    assets: bundle.assets.map(({ file: _file, ...asset }) => ({ ...asset, url: crystalArtworkUrl(bucket, asset) })),
  })
}
