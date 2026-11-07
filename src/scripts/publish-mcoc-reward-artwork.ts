import "dotenv/config"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { publishRewardArtwork, validateLocalRewardArtwork } from "../services/rewardArtworkService"
import { createCrystalOpeningCatalog } from "../domain/crystal-openings"
import { createRewardArtworkCatalog, createRewardColorPalette } from "../domain/reward-artwork"

async function main() {
  const args = process.argv.slice(2)
  for (const arg of args) if (!arg.startsWith("--manifest=") && !arg.startsWith("--directory=") && !arg.startsWith("--out=") && !arg.startsWith("--catalog=") && !arg.startsWith("--palette=") && arg !== "--upload-assets") throw new Error(`Unknown option: ${arg}`)
  const option = (name: string, fallback: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
  const input = JSON.parse(await fs.readFile(option("manifest", "temp/reward-artwork/local-colored.json"), "utf8")) as unknown
  const directory = option("directory", "temp/reward-artwork/assets")
  const { config } = await import("../config.js")
  const validated = await validateLocalRewardArtwork(input, directory, config.GCS_BUCKET_NAME)
  const openingBytes = await fs.readFile(option("catalog", "src/data/game-crystal-openings/catalog.json"))
  const openings = createCrystalOpeningCatalog(JSON.parse(openingBytes.toString("utf8")))
  const paletteBytes = await fs.readFile(option("palette", "src/data/game-reward-artwork/palette.json"))
  const colorPalette = createRewardColorPalette(JSON.parse(paletteBytes.toString("utf8")))
  if (validated.projected.source.colorDictionary && validated.projected.source.colorDictionary.paletteSha256 !== createHash("sha256").update(paletteBytes).digest("hex")) throw new Error("Reward palette file hash mismatch")
  createRewardArtworkCatalog(validated.projected, { gachaSha256: openings.source.gachaSha256,
    openingCatalogSha256: createHash("sha256").update(openingBytes).digest("hex"), colorPalette })
  if (!args.includes("--upload-assets")) {
    console.log(JSON.stringify({ mode: "validated-preview", bindings: validated.projected.assets.length, missing: validated.projected.missing.length,
      newImmutableObjects: validated.plans.filter(plan => plan.bytes).length, reusedObjects: validated.plans.filter(plan => !plan.bytes).length }))
    return
  }
  const { gcpStorageService } = await import("../services/gcpStorageService.js")
  const result = await publishRewardArtwork(input, directory, gcpStorageService, config.GCS_BUCKET_NAME, fetch,
    (done, total) => { if (done % 20 < 4 || done === total) console.log(`Verified reward artwork ${done}/${total}`) })
  const output = option("out", "src/data/game-reward-artwork/manifest.json")
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(`${output}.publishing`, JSON.stringify(result)+"\n", "utf8")
  await fs.rename(`${output}.publishing`, output)
  console.log(JSON.stringify({ mode: "published", bindings: result.assets.length, missing: result.missing.length }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Reward artwork publication failed"); process.exitCode = 1 })
