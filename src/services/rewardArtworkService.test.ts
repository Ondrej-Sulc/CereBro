import { createHash } from "node:crypto"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { afterEach, expect, it, vi } from "vitest"
import { publishRewardArtwork } from "./rewardArtworkService"

const dirs: string[] = []
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "reward-artwork-")); dirs.push(directory)
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 200, g: 80, b: 30, alpha: 0.5 } } }).webp({ lossless: true }).toBuffer()
  const sha256 = hash(bytes)
  await mkdir(path.join(directory, "fragment"))
  await writeFile(path.join(directory, "fragment", `${sha256}.webp`), bytes)
  const bundle = { version: 1, source: { observedAt: "2026-11-05T14:05:24+00:00", gachaSha256: "a".repeat(64), openingCatalogSha256: "b".repeat(64),
    gameMetadataSha256: "c".repeat(64), reusedCrystalManifestSha256: "d".repeat(64), cdnBaseUrl: "https://kabam-marvel.shared.mcoc-cdn.net/", registries: [], metadata: [] },
    assets: [{ type: "ebpf", data: "rare_event", role: "fragment", registry: "evo", registryId: "rare_event", source: "resource", reference: "portraits/catalyst_fragment",
      tintApplied: false, origin: "game-resource", file: `fragment/${sha256}.webp`, sha256, inputSha256: "e".repeat(64), width: 2, height: 2 }],
    missing: [], coverage: { bindings: 1, resolved: 1, missing: 0, resolvedByType: { ebpf: 1 } } }
  return { directory, bytes, bundle }
}
afterEach(async () => {
  for (const directory of dirs.splice(0)) {
    const resolved = path.resolve(directory)
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("reward-artwork-")) throw new Error("Unsafe test cleanup")
    await rm(resolved, { recursive: true, force: true })
  }
})

it("validates local image bytes and verifies the uploaded public immutable object", async () => {
  const f = await fixture()
  const upload = vi.fn(async (_bytes: Buffer, destination: string) => `https://storage.googleapis.com/champion-images/${destination}`)
  const get = vi.fn(async () => new Response(new Uint8Array(f.bytes)))
  const result = await publishRewardArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images", get)
  expect(upload).toHaveBeenCalledWith(f.bytes, `rewards/fragment/${hash(f.bytes)}.webp`, "image/webp")
  expect(get).toHaveBeenCalledOnce()
  expect(result.assets[0]).not.toHaveProperty("file")
  expect(result.assets[0].url).toContain(`/rewards/fragment/${hash(f.bytes)}.webp`)
})

it("checks every local hash and actual image dimensions before any publication", async () => {
  const f = await fixture(); f.bundle.assets[0].width = 10
  const upload = vi.fn()
  await expect(publishRewardArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images")).rejects.toThrow(/dimensions/)
  expect(upload).not.toHaveBeenCalled()
  f.bundle.assets[0].width = 2
  await writeFile(path.join(f.directory, f.bundle.assets[0].file), "modified")
  await expect(publishRewardArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images")).rejects.toThrow(/hash/)
  expect(upload).not.toHaveBeenCalled()
})

it("reuses exact existing crystal objects only after checking their public bytes", async () => {
  const f = await fixture(); const sha = hash(f.bytes)
  const reused = { ...f.bundle, assets: [{ ...f.bundle.assets[0], file: undefined, origin: "published-crystal",
    reuseUrl: `https://storage.googleapis.com/champion-images/crystals/primary/${sha}.webp` }] }
  const upload = vi.fn()
  const get = vi.fn(async () => new Response(new Uint8Array(f.bytes)))
  const result = await publishRewardArtwork(reused, f.directory, { uploadImmutableBuffer: upload }, "champion-images", get)
  expect(upload).not.toHaveBeenCalled()
  expect(result.assets[0].url).toBe(reused.assets[0].reuseUrl)
  get.mockImplementation(async () => new Response("different"))
  await expect(publishRewardArtwork(reused, f.directory, { uploadImmutableBuffer: upload }, "champion-images", get)).rejects.toThrow(/hash/)
})
