import "dotenv/config"
import fs from "node:fs/promises"
import path from "node:path"
import { publishCrystalArtwork } from "../services/crystalArtworkService"
import { localCrystalArtworkSchema } from "../domain/crystal-artwork"
import { crystalArtworkUrl } from "../domain/crystal-artwork"
import { createCrystalCatalog } from "../domain/champion-crystals"

async function main() {
  const args = process.argv.slice(2)
  for (const arg of args) if (!arg.startsWith("--manifest=") && !arg.startsWith("--directory=") && !arg.startsWith("--out=") && !arg.startsWith("--catalog=") && arg !== "--upload-assets") throw new Error(`Unknown option: ${arg}`)
  const option = (name: string, fallback: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
  const manifestFile = option("manifest", "temp/crystals/artwork-local.json")
  const directory = option("directory", "temp/crystals/artwork-assets")
  const output = option("out", "src/data/game-crystals/artwork.json")
  const bundle = localCrystalArtworkSchema.parse(JSON.parse(await fs.readFile(manifestFile, "utf8")))
  if (!args.includes("--upload-assets")) {
    console.log(JSON.stringify({ mode: "preview", bindings: bundle.assets.length, missing: bundle.missing.length, objects: new Set(bundle.assets.map(a => a.file)).size }))
    return
  }
  const { config } = await import("../config.js")
  const catalog = JSON.parse(await fs.readFile(option("catalog", "src/data/game-crystals/catalog.json"), "utf8")) as unknown
  // Check every source binding against the catalog before any upload, using the
  // exact URLs the verified publication will produce.
  createCrystalCatalog(catalog, { ...bundle, source: { ...bundle.source, bucket: config.GCS_BUCKET_NAME },
    assets: bundle.assets.map(({ file: _file, ...asset }) => ({ ...asset, url: crystalArtworkUrl(config.GCS_BUCKET_NAME, asset) })) })
  const { gcpStorageService } = await import("../services/gcpStorageService.js")
  const result = await publishCrystalArtwork(bundle, directory, gcpStorageService, config.GCS_BUCKET_NAME, fetch,
    (done, total) => { if (done % 20 === 0 || done === total) console.log(`Verified cloud artwork ${done}/${total}`) })
  // Publish the manifest only after every public cloud object has been checked.
  await fs.mkdir(path.dirname(output), { recursive: true })
  const temporary = `${output}.publishing`
  await fs.writeFile(temporary, JSON.stringify(result) + "\n", "utf8")
  await fs.rename(temporary, output)
  console.log(JSON.stringify({ mode: "published", bucket: config.GCS_BUCKET_NAME, bindings: result.assets.length, missing: result.missing.length }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Crystal artwork publication failed"); process.exitCode = 1 })
