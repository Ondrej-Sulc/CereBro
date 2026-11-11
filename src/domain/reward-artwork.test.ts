import { expect, it } from "vitest"
import { createRewardArtworkCatalog, createRewardColorPalette } from "./reward-artwork"

const hash = "a".repeat(64)
export const artworkFixture = () => ({ version: 1,
  source: { observedAt: "2026-11-05T14:05:24+00:00", gachaSha256: hash, openingCatalogSha256: hash,
    gameMetadataSha256: hash, cdnBaseUrl: "https://kabam-marvel.shared.mcoc-cdn.net/", reusedCrystalManifestSha256: hash,
    registries: [], metadata: [], bucket: "champion-images" },
  assets: [{ type: "ebpf", data: "rare_event", role: "fragment", source: "resource", reference: "portraits/t3_fragment",
    registry: "evo", registryId: "rare_event", tintApplied: false, tintColor: "23c5ff", origin: "game-resource",
    sha256: hash, inputSha256: hash, width: 128, height: 128,
    url: `https://storage.googleapis.com/champion-images/rewards/fragment/${hash}.webp` }],
  missing: [{ type: "res", data: "unknown", role: "full", reason: "no-verified-artwork-reference" }],
  coverage: { bindings: 2, resolved: 1, missing: 1, resolvedByType: { ebpf: 1 } },
})

it("uses exact reward identity and fragment role, exposing explicit missing data", () => {
  const catalog = createRewardArtworkCatalog(artworkFixture(), { gachaSha256: hash })
  expect(catalog.getRewardArtwork("ebpf", "rare_event")?.tintApplied).toBe(false)
  expect(catalog.getRewardArtwork("ebpf", "rare_event", "full")).toBeNull()
  expect(catalog.getRewardArtwork("ebp", "rare_event")).toBeNull()
  expect(catalog.getRewardArtworkStatus("res", "unknown")).toEqual({ status: "missing", reason: "no-verified-artwork-reference" })
  expect(() => Object.assign(catalog.getRewardArtwork("ebpf", "rare_event")!, { url: "wrong" })).toThrow()
})

it("rejects mismatched snapshots, duplicate identities and unrelated hosted objects", () => {
  expect(() => createRewardArtworkCatalog(artworkFixture(), { gachaSha256: "b".repeat(64) })).toThrow(/snapshot/)
  const duplicate = artworkFixture(); duplicate.assets.push(duplicate.assets[0])
  expect(() => createRewardArtworkCatalog(duplicate)).toThrow()
  const unrelated = artworkFixture(); unrelated.assets[0].url = "https://other.example/image.webp"
  expect(() => createRewardArtworkCatalog(unrelated)).toThrow()
})

it("retains source-bound applied game tints and rejects incomplete rendering metadata", () => {
  const fixture = artworkFixture()
  const source = { ...fixture.source, colorDictionary: { fileName: "resources.assets", sha256: hash, objectSha256: hash, pathId: 5241, paletteSha256: hash } }
  const asset = { ...fixture.assets[0], tintApplied: true, renderTint: { source: "color-dictionary", key: "class_cosmic", rgba: [0, 0.6, 0.8, 1] } }
  const input = { ...fixture, source, assets: [asset] }
  const palette = createRewardColorPalette({ version: 1, source: { fileName: "resources.assets", sha256: hash, objectSha256: hash, pathId: 5241, metadataSha256: hash }, colors: { class_cosmic: [0, 0.6, 0.8, 1] } })
  const catalog = createRewardArtworkCatalog(input, { gachaSha256: hash, colorPalette: palette })
  expect(catalog.getRewardArtwork("ebpf", "rare_event")?.renderTint?.key).toBe("class_cosmic")
  expect(() => Object.assign(catalog.getRewardArtwork("ebpf", "rare_event")!.renderTint!.rgba, { 0: 1 })).toThrow()
  expect(() => createRewardArtworkCatalog({ ...input, assets: [{ ...asset, renderTint: { ...asset.renderTint, rgba: [0, 0.5, 0.8, 1] } }] }, { gachaSha256: hash, colorPalette: palette })).toThrow(/palette/)
  expect(() => createRewardArtworkCatalog({ ...input, assets: [{ ...asset, renderTint: undefined }] })).toThrow()
  expect(() => createRewardArtworkCatalog({ ...input, assets: [{ ...asset, renderTint: { ...asset.renderTint, rgba: [0, 2, 0.8, 1] } }] })).toThrow()
})

it("requires source-bound selector identity and definition provenance", () => {
  const fixture = artworkFixture()
  const id = "69152ddc4d51d164bc3ea06f"
  const asset = { ...fixture.assets[0], type: "sra", data: id, role: "full", registry: "selectable-reward", registryId: id,
    url: `https://storage.googleapis.com/champion-images/rewards/full/${hash}.webp` }
  const input = { ...fixture, assets: [asset] }
  expect(() => createRewardArtworkCatalog(input)).toThrow(/selector provenance/)
  const source = { ...fixture.source, selectableRewards: { catalogSha256: hash, observedAt: "2026-11-06T12:00:00Z", gameAssemblySha256: hash, metadataSha256: hash } }
  expect(createRewardArtworkCatalog({ ...input, source }).getRewardArtwork("sra", id)?.registryId).toBe(id)
  expect(() => createRewardArtworkCatalog({ ...input, source, assets: [{ ...asset, registryId: "wrong" }] })).toThrow(/selector provenance/)
})

it("requires the reviewed inventory overlay shader, exact registry identity and class palette", () => {
  const fixture = artworkFixture()
  const source = { ...fixture.source,
    colorDictionary: { fileName: "resources.assets", sha256: hash, objectSha256: hash, pathId: 5241, paletteSha256: hash },
    inventoryShader: { name: "EBG/UI/OverlayColored", fileName: "resources.assets", sha256: hash, pathId: 506,
      objectSha256: "60d753e9a57e49ea3c53f436c9061571fc1ac90ffc8e69c83af1f4afd3e22d5e" } }
  const asset = { ...fixture.assets[0], type: "inv", data: "awaken_t6_mutant", role: "full", registry: "gamestore",
    registryId: "awaken_t6_mutant", reference: "inventory/Awaken", classId: "mutant", tintApplied: true,
    renderTint: { source: "color-dictionary", key: "class_mutant", rgba: [1, 0.8, 0, 1], blendMode: "overlay" },
    url: `https://storage.googleapis.com/champion-images/rewards/full/${hash}.webp` }
  const input = { ...fixture, source, assets: [asset] }
  expect(createRewardArtworkCatalog(input).getRewardArtwork("inv", "awaken_t6_mutant")?.renderTint?.blendMode).toBe("overlay")
  for (const change of [{ registryId: "other" }, { classId: "tech" }, { reference: "unreviewed" },
    { renderTint: { ...asset.renderTint, blendMode: undefined } }, { registry: "evo" }]) {
    expect(() => createRewardArtworkCatalog({ ...input, assets: [{ ...asset, ...change }] })).toThrow()
  }
  expect(() => createRewardArtworkCatalog({ ...input, source: { ...source, inventoryShader: undefined } })).toThrow()
  expect(() => createRewardArtworkCatalog({ ...input, source: { ...source, inventoryShader: { ...source.inventoryShader, sha256: "b".repeat(64) } } })).toThrow()
})

it("requires the separate native material binding proof before accepting catalyst overlay", () => {
  const fixture = artworkFixture()
  const colorDictionary = { fileName: "resources.assets", sha256: hash, objectSha256: hash, pathId: 5241, paletteSha256: hash }
  const materialShader = { name: "EBG/UI/OverlayColored", fileName: "resources.assets", sha256: hash, pathId: 506,
    objectSha256: "60d753e9a57e49ea3c53f436c9061571fc1ac90ffc8e69c83af1f4afd3e22d5e",
    bindingProofSha256: "7d6c8c80868340a3c215545b7e1ac8f675ed3bde4f94e9b91a49889d363e93a3" }
  const asset = { ...fixture.assets[0], tintApplied: true,
    renderTint: { source: "blueprint", rgba: [0.1, 0.8, 1, 1], blendMode: "overlay" } }
  const input = { ...fixture, source: { ...fixture.source, colorDictionary, materialShader }, assets: [asset] }
  expect(createRewardArtworkCatalog(input).getRewardArtwork("ebpf", "rare_event")?.renderTint?.blendMode).toBe("overlay")
  expect(() => createRewardArtworkCatalog({ ...input, source: { ...input.source, materialShader: undefined } })).toThrow()
  expect(() => createRewardArtworkCatalog({ ...input, source: { ...input.source, materialShader: { ...materialShader, bindingProofSha256: hash } } })).toThrow()
  expect(() => createRewardArtworkCatalog({ ...input, assets: [{ ...asset, type: "res" }] })).toThrow()
  expect(() => createRewardArtworkCatalog({ ...input, assets: [{ ...asset, renderTint: { ...asset.renderTint, blendMode: undefined } }] })).toThrow()
})
