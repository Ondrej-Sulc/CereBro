import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getChampionCrystalAscensionSources } from "@/lib/data/champion-crystal-ascension"
import { getChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition"
import type { ChampionAscensionSourcePayload } from "@/lib/champion-ascension-source-payload"

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const rarity = new URL(request.url).searchParams.get("rarity")
  if (!rarity || !/^[1-7]$/.test(rarity)) return NextResponse.json({ error: "Invalid star level" }, { status: 400 })
  const { slug } = await params
  const champion = await prisma.champion.findUnique({ where: { slug }, select: { gameId: true } })
  if (!champion?.gameId) return NextResponse.json({ error: "Champion not found" }, { status: 404 })
  const payload: ChampionAscensionSourcePayload = {
    ...getChampionCrystalAscensionSources(champion.gameId, Number(rarity)),
    acquisition: getChampionAscensionAcquisitionSources(champion.gameId, Number(rarity)),
  }
  return NextResponse.json(payload,
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } })
}
