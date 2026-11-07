import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditChampionAcquisitionCoverage } from "../data/champion-acquisition/coverage"
import { crystalCatalogSource } from "../data/game-crystals"

async function main() {
  const prisma = new PrismaClient()
  try {
    const champions = await prisma.champion.findMany({
      where: { isPlayable: true, gameId: { not: null } },
      select: { name: true, gameId: true, slug: true, obtainable: true, stats: { distinct: ["rarity"], select: { rarity: true } } },
      orderBy: { name: "asc" },
    })
    const report = {
      observedAt: new Date().toISOString(),
      scope: "Every playable champion/star pair listed in obtainable metadata. Imported stats separately establish page visibility. Direct crystal membership and reviewed methods are matched at the same star level. Metadata and missing evidence do not establish player availability; nested selectors are separate acquisition routes.",
      crystalSource: crystalCatalogSource,
      championMetadataSha256: createHash("sha256").update(JSON.stringify(champions)).digest("hex"),
      acquisitionCatalogSha256: createHash("sha256").update(readFileSync(resolve(__dirname, "../data/champion-acquisition/catalog.json"))).digest("hex"),
      ...auditChampionAcquisitionCoverage(champions),
    }
    const output = process.argv[2]
    if (output) {
      writeFileSync(output, JSON.stringify(report, null, 2) + "\n", "utf8")
      process.stdout.write(JSON.stringify(report.counts) + "\n")
    } else process.stdout.write(JSON.stringify(report, null, 2) + "\n")
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1 })
