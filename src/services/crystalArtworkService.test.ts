import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { publishCrystalArtwork } from "./crystalArtworkService"

const directories: string[] = []
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
async function fixture(role: "primary" | "banner" = "primary") {
  const directory = await mkdtemp(path.join(os.tmpdir(), "crystal-artwork-"))
  directories.push(directory)
  const bytes = Buffer.from("verified game image bytes")
  const sha256 = hash(bytes)
  await mkdir(path.join(directory, role))
  await writeFile(path.join(directory, role, `${sha256}.webp`), bytes)
  return { directory, bytes, bundle: { version: 3, source: { gachaSha256: "a".repeat(64), gameMetadataSha256: "b".repeat(64), cdnBaseUrl: "https://kabam-marvel.shared.mcoc-cdn.net/" },
    assets: [{ role, source: "cdn", reference: "gacha/hero.png", file: `${role}/${sha256}.webp`, sha256, inputSha256: "c".repeat(64), width: 256, height: 256 }], missing: [] } }
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const target = path.resolve(directory)
    if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("crystal-artwork-")) throw new Error("Unexpected test cleanup target")
    await rm(target, { recursive: true, force: true })
  }
})

it("deduplicates verified immutable uploads and checks the publicly served bytes", async () => {
  const f = await fixture()
  f.bundle.assets.push({ ...f.bundle.assets[0], reference: "gacha/alias.png" })
  const upload = vi.fn(async (_bytes: Buffer, destination: string) => `https://storage.googleapis.com/champion-images/${destination}`)
  const fetchImage = vi.fn(async () => new Response(new Uint8Array(f.bytes)))
  const result = await publishCrystalArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images", fetchImage)
  expect(upload).toHaveBeenCalledOnce()
  expect(upload).toHaveBeenCalledWith(f.bytes, `crystals/primary/${hash(f.bytes)}.webp`, "image/webp")
  expect(fetchImage).toHaveBeenCalledOnce()
  expect(result.assets).toHaveLength(2)
  expect(result.assets[0].url).toBe(`https://storage.googleapis.com/champion-images/crystals/primary/${hash(f.bytes)}.webp`)
  expect(result.assets[0]).not.toHaveProperty("file")
})

it("validates all local hashes before making an upload", async () => {
  const f = await fixture()
  await writeFile(path.join(f.directory, f.bundle.assets[0].file), "changed")
  const upload = vi.fn()
  await expect(publishCrystalArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images")).rejects.toThrow(/changed|hash/i)
  expect(upload).not.toHaveBeenCalled()
})

it("publishes banners under their own role without treating them as primary icons", async () => {
  const f = await fixture("banner")
  const upload = vi.fn(async (_bytes: Buffer, destination: string) => `https://storage.googleapis.com/champion-images/${destination}`)
  const fetchImage = vi.fn(async () => new Response(new Uint8Array(f.bytes)))
  const result = await publishCrystalArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images", fetchImage)
  expect(upload).toHaveBeenCalledWith(f.bytes, `crystals/banner/${hash(f.bytes)}.webp`, "image/webp")
  expect(result.assets[0].role).toBe("banner")
  expect(result.assets[0].url).toBe(`https://storage.googleapis.com/champion-images/crystals/banner/${hash(f.bytes)}.webp`)
})

it("rejects unrelated bucket URLs and mismatched public bytes", async () => {
  const f = await fixture()
  const upload = vi.fn(async (_bytes: Buffer, destination: string) => `https://storage.googleapis.com/wrong-bucket/${destination}`)
  const fetchImage = vi.fn(async () => new Response(new Uint8Array(f.bytes)))
  await expect(publishCrystalArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images", fetchImage)).rejects.toThrow(/cloud|bucket/i)
  expect(fetchImage).not.toHaveBeenCalled()
  upload.mockImplementation(async (_bytes: Buffer, destination: string) => `https://storage.googleapis.com/champion-images/${destination}`)
  fetchImage.mockImplementation(async () => new Response("changed public object"))
  await expect(publishCrystalArtwork(f.bundle, f.directory, { uploadImmutableBuffer: upload }, "champion-images", fetchImage)).rejects.toThrow(/hash/i)
})
