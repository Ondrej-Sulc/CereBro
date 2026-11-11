import "server-only"
import { prisma } from "@/lib/prisma"
import { getFromCache } from "@/lib/cache"
import { publicCuratedModifierSelect, type PublicCuratedModifier } from "@cerebro/core/domain/node-modifiers/public-catalog"

/** Public fields only: deliberately compatible with the unapplied iconKey column. */
export async function getPublicCuratedModifiers(): Promise<PublicCuratedModifier[]> {
  return getFromCache("public-node-modifiers:id-name-description:v1", 300, async () => {
    const records = await prisma.nodeModifier.findMany({ select: publicCuratedModifierSelect, orderBy: [{ name: "asc" }, { id: "asc" }], take: 50001 })
    if (records.length > 50000) throw new Error("Public modifier catalog requires a larger bounded reader")
    return records
  })
}
